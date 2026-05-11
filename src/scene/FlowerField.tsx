import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';

const COUNT = 870;
const FIELD_SIZE = 40;
const RIPPLE_RADIUS = 2.4;
const RIPPLE_HALF_LIFE = 0.4;

const STEM_HEIGHT = 0.6;
const STEM_RADIUS = 0.028;
const STEM_SIDES = 6;

// Reference: hepatica-style — 7 broad overlapping petals, nearly horizontal
// with a slight upward tip curl. Petal half-width at mid-length is ~0.22,
// angular spacing 360/7 ≈ 51° → petals overlap by ~40° each side.
const PETALS = 7;
const PETAL_BASE_OFFSET = 0.085; // petals start at a small ring, not the axis
const PETAL_LEN = 0.55;
const PETAL_WIDTH = 0.36;
const PETAL_CUP = 0.14;
const PETAL_PITCH = 0.16;
const PETAL_Y_STAGGER = 0.018; // alternating up/down per petal
const PETAL_PITCH_JITTER = 0.07;
const PETAL_YAW_JITTER = 0.06;
const PETAL_SEG_V = 8;
const PETAL_SEG_U = 5;

// ~22 thin tall filaments — should read as a fine bristly cluster, not rods.
const STAMEN_COUNT = 22;
const STAMEN_RING_R = 0.085;
const STAMEN_BASE_R = 0.005;
const STAMEN_TIP_R = 0.0075;
const STAMEN_HEIGHT = 0.105;
const STAMEN_SIDES = 4;

const PISTIL_R = 0.045;
const PISTIL_SIDES = 8;

// Region tags written into UV.x.
const R_STEM = 0.05;
const R_PETAL = 0.40;
const R_PISTIL = 0.70;
const R_STAMEN = 1.00;

function buildFlowerGeometry(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // --- Stem ---
  for (let ring = 0; ring < 2; ring++) {
    const y = ring === 0 ? 0 : STEM_HEIGHT;
    for (let i = 0; i < STEM_SIDES; i++) {
      const a = (i / STEM_SIDES) * Math.PI * 2;
      positions.push(Math.cos(a) * STEM_RADIUS, y, Math.sin(a) * STEM_RADIUS);
      uvs.push(R_STEM, ring);
    }
  }
  for (let i = 0; i < STEM_SIDES; i++) {
    const b1 = i;
    const b2 = (i + 1) % STEM_SIDES;
    const t1 = STEM_SIDES + i;
    const t2 = STEM_SIDES + ((i + 1) % STEM_SIDES);
    indices.push(b1, b2, t2, b1, t2, t1);
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
      const w = PETAL_WIDTH * Math.pow(Math.sin(v * Math.PI), 0.75);

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
        // uv.y carries petal-v; lateral u stored in `aLocalU` below.
        uvs.push(R_PETAL, v);
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

  // --- Pistil: small olive dome (cone) at center ---
  const pistilBaseY = STEM_HEIGHT + 0.02;
  const pistilTipY = pistilBaseY + 0.03;
  const pistilBaseIdx = positions.length / 3;
  for (let i = 0; i < PISTIL_SIDES; i++) {
    const a = (i / PISTIL_SIDES) * Math.PI * 2;
    positions.push(Math.cos(a) * PISTIL_R, pistilBaseY, Math.sin(a) * PISTIL_R);
    uvs.push(R_PISTIL, 0);
  }
  const pistilTipIdx = positions.length / 3;
  positions.push(0, pistilTipY, 0);
  uvs.push(R_PISTIL, 1);
  for (let i = 0; i < PISTIL_SIDES; i++) {
    indices.push(
      pistilBaseIdx + i,
      pistilBaseIdx + ((i + 1) % PISTIL_SIDES),
      pistilTipIdx
    );
  }

  // --- Stamens: 14 small 3D rods with bulb tips, in a ring around the pistil ---
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
    }
    // cap center
    const capIdx = positions.length / 3;
    positions.push(cx, stamenTipY + 0.006, cz);
    uvs.push(R_STAMEN, 1.0);

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
      uniform float uTime;
      varying float vBoost;
      varying vec3 vColor;
      varying float vRegion;
      varying float vU;
      varying vec3 vNormal;

      void main() {
        vBoost = aBoost;
        vColor = aColor;
        vRegion = uv.x;
        vU = uv.y;
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
      varying vec3 vNormal;
      uniform float uEmissiveStrength;

      void main() {
        vec3 col;
        if (vRegion < 0.20) {
          col = vec3(0.022, 0.045, 0.028);
        } else if (vRegion < 0.55) {
          // Petal: base→tip gradient — darker saturated at base, brighter
          // and slightly cyaner toward the tip. Subtle rim from normal.
          // Saturated electric blue. Slightly lighter near the base (where
          // petals catch ambient bounce) and a touch darker / less saturated
          // toward the tips so silhouettes read cleanly.
          vec3 petalBase = vColor * 0.78 + vec3(0.04, 0.06, 0.10);
          vec3 petalTip  = vColor * 0.55;
          col = mix(petalBase, petalTip, vU);
          // Subtle inner-cup cyan brightening near the stamen ring.
          float innerCup = (1.0 - vU) * 0.4;
          col = mix(col, vec3(0.25, 0.45, 0.75), innerCup * 0.35);
          // Lambert-ish facing factor — petals facing up get slight lift.
          float face = clamp(vNormal.y, 0.0, 1.0);
          col *= mix(0.85, 1.15, face);
          col *= uEmissiveStrength * (1.0 + vBoost * 1.6);
        } else if (vRegion < 0.85) {
          // Pistil — olive dome, slightly brighter at tip.
          col = mix(vec3(0.05, 0.06, 0.025), vec3(0.20, 0.20, 0.06), vU);
        } else {
          // Stamen — pale filament at base, bright cream bulb at tip.
          vec3 base = vec3(0.50, 0.46, 0.32);
          vec3 tip  = vec3(1.10, 1.05, 0.85);
          col = mix(base, tip, smoothstep(0.6, 1.0, vU));
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
  });
}

export default function FlowerField() {
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

    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * FIELD_SIZE;
      const z = (Math.random() - 0.5) * FIELD_SIZE;
      pos.set(x, (Math.random() - 0.5) * 0.04, z);
      positions[i * 2] = x;
      positions[i * 2 + 1] = z;
      const pitch = (Math.random() - 0.5) * 0.35;
      const yaw = Math.random() * Math.PI * 2;
      const roll = (Math.random() - 0.5) * 0.35;
      e.set(pitch, yaw, roll, 'YXZ');
      q.setFromEuler(e);
      const s = 0.75 + Math.random() * 0.55;
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
      // Electric cobalt-royal: hue ~0.62, near-max saturation, lifted L
      // so the petal reads as glowing blue at default exposure.
      baseColor.setHSL(
        0.62 + (Math.random() - 0.5) * 0.025,
        1.0,
        0.50 + Math.random() * 0.06
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
          const target = 0.5 * k;
          if (boosts[i] < target) boosts[i] = target;
        }
      }
    }
    (geometry.getAttribute('aBoost') as InstancedBufferAttribute).needsUpdate = true;
  });

  return (
    <>
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
    </>
  );
}
