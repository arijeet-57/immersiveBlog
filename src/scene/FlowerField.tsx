import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { useAppStore } from '../store/appStore';

// Flower field stays on past the bridge so the field doesn't vanish
// behind the camera mid-scroll — fog handles distance fade.
const FIELD_VISIBLE_TO = 0.70;

const COUNT = 2000;
const FIELD_SIZE = 40;
const RIPPLE_RADIUS = 2.4;
const RIPPLE_HALF_LIFE = 0.4;

const STEM_HEIGHT = 0.6;
const STEM_RADIUS = 0.028;
const STEM_SIDES = 12;
const STEM_RINGS = 8; // taper + bend along the length

// Reference: hepatica-style — 7 broad overlapping petals, nearly horizontal
// with a slight upward tip curl. Petal half-width at mid-length is ~0.22,
// angular spacing 360/7 ≈ 51° → petals overlap by ~40° each side.
// Hepatica nobilis reference: 6–7 broad rounded-oval petals, nearly flat,
// pure deep cobalt blue. No yellow disc — the center is a tight tuft of
// fine white stamens.
// 6 distinct lobed petals with visible gaps. Width profile tapers at
// both ends so each petal reads as a rounded oval, not a pie slice.
const PETALS = 6;
const PETAL_BASE_OFFSET = 0.05;
const PETAL_LEN = 0.57;
const PETAL_WIDTH = 0.18;
const PETAL_CUP = 0.06;
// Negative pitch = petal tip rises above base → concave cup facing the sky.
const PETAL_PITCH = -0.28;
const PETAL_Y_STAGGER = 0.012;
const PETAL_PITCH_JITTER = 0.05;
const PETAL_YAW_JITTER = 0.04;
const PETAL_SEG_V = 16;
const PETAL_SEG_U = 9;

// Dense tuft of fine white filaments — kept small so they read as
// pollen specks, not rods.
const STAMEN_COUNT = 26;
const STAMEN_RING_R = 0.048;
const STAMEN_BASE_R = 0.0022;
const STAMEN_TIP_R = 0.0034;
const STAMEN_HEIGHT = 0.058;
const STAMEN_SIDES = 4;

// Region tags written into UV.x.
const R_STEM = 0.05;
const R_PETAL = 0.40;
const R_CENTER = 0.70;
const R_STAMEN = 1.00;

// Yellow center sphere — sits beneath/inside the stamen tuft.
const CENTER_R = 0.038;
const CENTER_SEGMENTS = 10;
const CENTER_RINGS = 8;

function buildFlowerGeometry(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const localUs: number[] = []; // lateral 0..1 across petal; 0.5 for non-petal
  const indices: number[] = [];

  // --- Stem: multi-ring cylinder with subtle taper + lateral bend so the
  // silhouette reads as a living stem rather than a chamfered tube. ---
  for (let ring = 0; ring <= STEM_RINGS; ring++) {
    const v = ring / STEM_RINGS;
    const y = v * STEM_HEIGHT;
    // Tapers slightly thinner near the top (just below the head).
    const radius = STEM_RADIUS * (1 - 0.18 * Math.pow(v, 1.4));
    // Gentle S-bend so the stem isn't dead-straight.
    const bendX = Math.sin(v * Math.PI * 1.2) * 0.012;
    const bendZ = Math.sin(v * Math.PI * 0.8 + 1.7) * 0.010;
    for (let i = 0; i < STEM_SIDES; i++) {
      const a = (i / STEM_SIDES) * Math.PI * 2;
      positions.push(
        bendX + Math.cos(a) * radius,
        y,
        bendZ + Math.sin(a) * radius
      );
      // uv.y carries the 0..1 length param for shader gradients/noise.
      uvs.push(R_STEM, v);
      localUs.push(i / STEM_SIDES);
    }
  }
  for (let ring = 0; ring < STEM_RINGS; ring++) {
    const base = ring * STEM_SIDES;
    const next = (ring + 1) * STEM_SIDES;
    for (let i = 0; i < STEM_SIDES; i++) {
      const b1 = base + i;
      const b2 = base + ((i + 1) % STEM_SIDES);
      const t1 = next + i;
      const t2 = next + ((i + 1) % STEM_SIDES);
      indices.push(b1, b2, t2, b1, t2, t1);
    }
  }

  // --- Petals: 7 individual 3D petals radiating from a small inner ring.
  // Each petal gets its own pitch + yaw jitter + Y stagger so the head
  // reads as 3D-layered rather than a flat disk.
  // Per-petal lateral coordinate emitted into uv (slot reused: petal verts
  // use uv.y already for v; we encode lateral u via a derived varying in
  // the shader using normal/position — instead pack vRegion+lateral.
  // Simpler: write lateral-u into the THIRD UV channel? Three's ShaderMaterial
  // exposes only one UV. Use a custom attribute `aLocalU`.
  for (let petalIdx = 0; petalIdx < PETALS; petalIdx++) {
    const baseAngle = (petalIdx / PETALS) * Math.PI * 2;
    const yawJitter =
      (((petalIdx * 12.9898) % 1) - 0.5) * 2 * PETAL_YAW_JITTER;
    const pitchJitter =
      (((petalIdx * 7.9123) % 1) - 0.5) * 2 * PETAL_PITCH_JITTER;
    const petalAngle = baseAngle + yawJitter;
    const cosA = Math.cos(petalAngle);
    const sinA = Math.sin(petalAngle);
    const pitch = PETAL_PITCH + pitchJitter;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const yOffset = (petalIdx % 2 === 0 ? 1 : -1) * PETAL_Y_STAGGER;
    const baseIdx = positions.length / 3;

    for (let row = 0; row <= PETAL_SEG_V; row++) {
      const v = row / PETAL_SEG_V; // 0 at base of petal, 1 at tip
      // Capsule profile: tapered base, parallel sides through the middle,
      // rounded semicircular tip. Matches hepatica petals which are broad
      // and rounded at the tip rather than pointed.
      // Wider rounded cap → tip reads as a clean semicircle, not a stub.
      const baseEnd = 0.28;
      const tipStart = 0.55;
      let widthFactor: number;
      if (v < baseEnd) {
        const t = v / baseEnd;
        widthFactor = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
      } else if (v < tipStart) {
        widthFactor = 1.0;
      } else {
        const t = (v - tipStart) / (1 - tipStart);
        widthFactor = Math.sqrt(Math.max(0, 1 - t * t));
      }
      const w = PETAL_WIDTH * widthFactor;

      for (let col = 0; col <= PETAL_SEG_U; col++) {
        const u = col / PETAL_SEG_U; // 0..1 across petal width
        const localX = (u - 0.5) * 2 * w;
        // Y runs from PETAL_BASE_OFFSET (at petal base) outward to base+len.
        const localY = PETAL_BASE_OFFSET + v * PETAL_LEN;
        const cupFactor =
          (1.0 - Math.abs(2 * (u - 0.5))) * Math.sin(v * Math.PI);
        const localZ = PETAL_CUP * cupFactor;

        const pitchedY = cosP * localY + sinP * localZ;
        const verticalZ = -sinP * localY + cosP * localZ;

        const wx = cosA * pitchedY - sinA * localX;
        const wz = sinA * pitchedY + cosA * localX;
        const wy = STEM_HEIGHT + verticalZ + yOffset;

        positions.push(wx, wy, wz);
        uvs.push(R_PETAL, v);
        localUs.push(u);
      }
    }

    const colsPerRow = PETAL_SEG_U + 1;
    for (let row = 0; row < PETAL_SEG_V; row++) {
      for (let col = 0; col < PETAL_SEG_U; col++) {
        const a = baseIdx + row * colsPerRow + col;
        const b = a + 1;
        const c = a + colsPerRow;
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }
  }

  // --- Yellow center sphere: small ball at the flower's heart, nested
  // inside the ring of stamens. ---
  {
    const cy = STEM_HEIGHT + 0.022;
    const baseIdx = positions.length / 3;
    for (let ring = 0; ring <= CENTER_RINGS; ring++) {
      const phi = (ring / CENTER_RINGS) * Math.PI; // 0..π
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      for (let seg = 0; seg <= CENTER_SEGMENTS; seg++) {
        const theta = (seg / CENTER_SEGMENTS) * Math.PI * 2;
        const x = CENTER_R * sinPhi * Math.cos(theta);
        const z = CENTER_R * sinPhi * Math.sin(theta);
        const y = cy + CENTER_R * cosPhi;
        positions.push(x, y, z);
        uvs.push(R_CENTER, ring / CENTER_RINGS);
        localUs.push(0.5);
      }
    }
    const cols = CENTER_SEGMENTS + 1;
    for (let ring = 0; ring < CENTER_RINGS; ring++) {
      for (let seg = 0; seg < CENTER_SEGMENTS; seg++) {
        const a = baseIdx + ring * cols + seg;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }
  }

  // --- Stamens: dense tuft of fine white filaments. No yellow/olive
  // pistil — the reference center reads as pure stamen cluster. ---
  for (let s = 0; s < STAMEN_COUNT; s++) {
    const a = (s / STAMEN_COUNT) * Math.PI * 2;
    const cx = Math.cos(a) * STAMEN_RING_R;
    const cz = Math.sin(a) * STAMEN_RING_R;
    const stamenBaseY = STEM_HEIGHT + 0.015;
    const stamenTipY = stamenBaseY + STAMEN_HEIGHT;
    const baseIdx = positions.length / 3;

    // base ring
    for (let i = 0; i < STAMEN_SIDES; i++) {
      const sa = (i / STAMEN_SIDES) * Math.PI * 2;
      positions.push(
        cx + Math.cos(sa) * STAMEN_BASE_R,
        stamenBaseY,
        cz + Math.sin(sa) * STAMEN_BASE_R
      );
      uvs.push(R_STAMEN, 0);
      localUs.push(0.5);
    }
    // tip ring (slightly bulbous)
    for (let i = 0; i < STAMEN_SIDES; i++) {
      const sa = (i / STAMEN_SIDES) * Math.PI * 2;
      positions.push(
        cx + Math.cos(sa) * STAMEN_TIP_R,
        stamenTipY,
        cz + Math.sin(sa) * STAMEN_TIP_R
      );
      uvs.push(R_STAMEN, 0.8);
      localUs.push(0.5);
    }
    // cap center
    const capIdx = positions.length / 3;
    positions.push(cx, stamenTipY + 0.006, cz);
    uvs.push(R_STAMEN, 1.0);
    localUs.push(0.5);

    // side quads
    for (let i = 0; i < STAMEN_SIDES; i++) {
      const b1 = baseIdx + i;
      const b2 = baseIdx + ((i + 1) % STAMEN_SIDES);
      const t1 = baseIdx + STAMEN_SIDES + i;
      const t2 = baseIdx + STAMEN_SIDES + ((i + 1) % STAMEN_SIDES);
      indices.push(b1, b2, t2, b1, t2, t1);
    }
    // cap triangles
    for (let i = 0; i < STAMEN_SIDES; i++) {
      const t1 = baseIdx + STAMEN_SIDES + i;
      const t2 = baseIdx + STAMEN_SIDES + ((i + 1) % STAMEN_SIDES);
      indices.push(t2, t1, capIdx);
    }
  }

  const g = new BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setAttribute('aLocalU', new Float32BufferAttribute(localUs, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function buildFlowerMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEmissiveStrength: { value: 0.6 },
    },
    vertexShader: /* glsl */ `
      attribute float aBoost;
      attribute vec3 aColor;
      attribute float aSeed;
      attribute float aLocalU;
      uniform float uTime;
      varying float vBoost;
      varying vec3 vColor;
      varying float vRegion;
      varying float vU;
      varying float vLocalU;
      varying vec3 vNormal;

      void main() {
        vBoost = aBoost;
        vColor = aColor;
        vRegion = uv.x;
        vU = uv.y;
        vLocalU = aLocalU;
        vNormal = normalize(normalMatrix * normal);

        vec3 p = position;
        // gentle sway — only head moves
        float headMask = smoothstep(0.25, 0.55, position.y);
        p.x += sin(uTime * 0.9 + aSeed * 6.2831) * 0.010 * headMask;
        p.z += cos(uTime * 0.7 + aSeed * 6.2831) * 0.010 * headMask;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vBoost;
      varying vec3 vColor;
      varying float vRegion;
      varying float vU;
      varying float vLocalU;
      varying vec3 vNormal;
      uniform float uEmissiveStrength;

      void main() {
        vec3 col;
        if (vRegion < 0.20) {
          // Stem: dark mossy green with longitudinal noise mottling and a
          // subtle cyan bleed near the top where the petal glow leaks down.
          float stemV = vU; // 0 at base, 1 just below the head
          vec3 stemA = vec3(0.070, 0.190, 0.090);
          vec3 stemB = vec3(0.040, 0.120, 0.060);
          float n = fract(sin(vLocalU * 41.0 + stemV * 17.0) * 43758.5453);
          float mottle = mix(0.85, 1.20, smoothstep(0.4, 0.7, n));
          col = mix(stemB, stemA, mottle * 0.55 + 0.35);
          // Cyan glow near the top, falling off downward.
          float topGlow = smoothstep(0.55, 1.0, stemV);
          col += vec3(0.04, 0.10, 0.18) * topGlow * 0.55;
          // Lateral facing: slightly brighter sides catch moonlight.
          float face = clamp(abs(vNormal.x) + abs(vNormal.z) * 0.5, 0.0, 1.0);
          col *= mix(0.85, 1.08, face);
        } else if (vRegion < 0.55) {
          // Hepatica petal: deep cobalt-royal base, with subtle longitudinal
          // veining and a slightly darker rim — matches the silhouette
          // texture visible in the reference photograph.
          vec3 petalBase = vColor * 0.95;
          vec3 petalTip  = vColor * 0.70;
          col = mix(petalBase, petalTip, vU);

          // Edge darkening: deepen the cobalt toward the lateral petal
          // edges, lift the centerline. lateral = 0 at centerline, 1 at edge.
          float lateral = abs(vLocalU - 0.5) * 2.0;
          float edgeShade = pow(lateral, 1.4) * 0.62;
          col *= (1.0 - edgeShade);

          // Central spine — a clear brighter ridge running base→tip.
          float spine = 1.0 - smoothstep(0.0, 0.10, lateral);
          col += vColor * spine * 0.35 * sin(vU * 3.14159);

          // Longitudinal veins — strong parallel ribs that fade at tip.
          // Subtractive so they read as deeper-blue grooves.
          float veinPhase = vLocalU * 10.0;
          float veinMask = pow(0.5 + 0.5 * cos(veinPhase * 3.14159), 6.0);
          float veinFade = sin(vU * 3.14159);
          col *= (1.0 - veinMask * veinFade * 0.45);

          // Tip blush — a slightly brighter halo near the rounded petal
          // tip, picking up moonlight like the reference.
          float tipGlow = smoothstep(0.75, 1.0, vU) * (1.0 - lateral * 0.6);
          col += vColor * tipGlow * 0.18;

          float face = clamp(vNormal.y, 0.0, 1.0);
          col *= mix(0.88, 1.10, face);
          col *= uEmissiveStrength * (1.0 + vBoost * 1.6);
        } else if (vRegion < 0.85) {
          // Yellow center sphere — saturated golden yellow, slight rim lift.
          vec3 yBase = vec3(1.10, 0.85, 0.18);
          vec3 yTop  = vec3(1.30, 1.05, 0.30);
          col = mix(yBase, yTop, clamp(vNormal.y, 0.0, 1.0));
        } else {
          // Stamen — clean white filament, slightly brighter tip.
          vec3 base = vec3(0.85, 0.85, 0.82);
          vec3 tip  = vec3(1.20, 1.18, 1.05);
          col = mix(base, tip, smoothstep(0.55, 1.0, vU));
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
  });
}

export default function FlowerField() {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<InstancedMesh>(null);
  const positionsRef = useRef(new Float32Array(COUNT * 2));
  const boostsRef = useRef(new Float32Array(COUNT));
  const mouseWorld = useRef<Vector3 | null>(null);

  const geometry = useMemo(() => buildFlowerGeometry(), []);
  const material = useMemo(() => buildFlowerMaterial(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new Matrix4();
    const pos = new Vector3();
    const q = new Quaternion();
    const e = new Euler();
    const scale = new Vector3();
    const positions = positionsRef.current;

    // Jittered grid placement — eliminates the clumping that pure random
    // sampling produces. Each grid cell holds at most one flower, offset
    // within its cell so the layout still reads as organic.
    const gridN = Math.ceil(Math.sqrt(COUNT));
    const cell = FIELD_SIZE / gridN;
    const half = FIELD_SIZE * 0.5;
    const cellOrder: number[] = [];
    for (let k = 0; k < gridN * gridN; k++) cellOrder.push(k);
    // Fisher–Yates shuffle so the first COUNT cells are a random subset
    // when gridN² > COUNT.
    for (let k = cellOrder.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [cellOrder[k], cellOrder[j]] = [cellOrder[j], cellOrder[k]];
    }

    for (let i = 0; i < COUNT; i++) {
      const cellIdx = cellOrder[i];
      const gx = cellIdx % gridN;
      const gz = Math.floor(cellIdx / gridN);
      // Jitter within ~70% of the cell to leave a small gap between
      // neighbors and avoid intersection at max scale.
      const jitter = cell * 0.7;
      const x = -half + (gx + 0.5) * cell + (Math.random() - 0.5) * jitter;
      const z = -half + (gz + 0.5) * cell + (Math.random() - 0.5) * jitter;
      pos.set(x, (Math.random() - 0.5) * 0.04, z);
      positions[i * 2] = x;
      positions[i * 2 + 1] = z;
      const pitch = (Math.random() - 0.5) * 0.35;
      const yaw = Math.random() * Math.PI * 2;
      const roll = (Math.random() - 0.5) * 0.35;
      e.set(pitch, yaw, roll, 'YXZ');
      q.setFromEuler(e);
      const s = 0.55 + Math.random() * 0.35;
      scale.set(s, s, s);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const seeds = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const baseColor = new Color();
    for (let i = 0; i < COUNT; i++) {
      seeds[i] = Math.random();
      // Hepatica cobalt: deep royal blue, hue ~0.64 (slight violet lean,
      // matches the reference photo), full saturation, mid lightness.
      baseColor.setHSL(
        0.64 + (Math.random() - 0.5) * 0.02,
        1.0,
        0.46 + Math.random() * 0.05
      );
      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }
    geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    geometry.setAttribute('aColor', new InstancedBufferAttribute(colors, 3));
    geometry.setAttribute('aBoost', new InstancedBufferAttribute(boostsRef.current, 1));
  }, [geometry]);

  useFrame((state, dt) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    const boosts = boostsRef.current;
    const positions = positionsRef.current;
    const decay = Math.pow(0.5, dt / RIPPLE_HALF_LIFE);
    for (let i = 0; i < boosts.length; i++) boosts[i] *= decay;

    const mp = mouseWorld.current;
    if (mp) {
      const mx = mp.x;
      const mz = mp.z;
      const r2 = RIPPLE_RADIUS * RIPPLE_RADIUS;
      for (let i = 0; i < COUNT; i++) {
        const dx = positions[i * 2] - mx;
        const dz = positions[i * 2 + 1] - mz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r2) {
          const k = 1 - d2 / r2;
          // Increased from 0.5 to 4.0 so flowers glow brightly under the cursor
          const target = 4.0 * k;
          if (boosts[i] < target) boosts[i] = target;
        }
      }
    }
    (geometry.getAttribute('aBoost') as InstancedBufferAttribute).needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[geometry, material, COUNT]} frustumCulled={false} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        onPointerMove={(e) => {
          if (!mouseWorld.current) mouseWorld.current = new Vector3();
          mouseWorld.current.copy(e.point);
        }}
        onPointerOut={() => {
          mouseWorld.current = null;
        }}
      >
        <planeGeometry args={[FIELD_SIZE, FIELD_SIZE]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}
