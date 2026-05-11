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
const STEM_SIDES = 5;

const PETAL_COUNT = 6;
const PETAL_PERIMETER = 36;
const PETAL_INNER_R = 0.55;
const PETAL_AMP = 0.45;
const PETAL_SHARPNESS = 0.55;
const PETAL_CUP = 0.16;

const STAMEN_COUNT = 12;
const STAMEN_RING_R = 0.14;
const STAMEN_SIZE = 0.030;

const PISTIL_R = 0.055;
const PISTIL_SIDES = 6;

// Region tags written into UV.x so the fragment shader can branch.
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
      uvs.push(R_STEM, 0.0);
    }
  }
  for (let i = 0; i < STEM_SIDES; i++) {
    const b1 = i;
    const b2 = (i + 1) % STEM_SIDES;
    const t1 = STEM_SIDES + i;
    const t2 = STEM_SIDES + ((i + 1) % STEM_SIDES);
    indices.push(b1, b2, t2, b1, t2, t1);
  }

  // --- Petal head (6 rounded lobes via |cos(3θ)|, slightly cupped) ---
  const petalCenterY = STEM_HEIGHT + PETAL_CUP * 0.2;
  const petalCenterIdx = positions.length / 3;
  positions.push(0, petalCenterY, 0);
  uvs.push(R_PETAL, 1.0);

  for (let i = 0; i < PETAL_PERIMETER; i++) {
    const theta = (i / PETAL_PERIMETER) * Math.PI * 2;
    const lobe = Math.pow(
      Math.abs(Math.cos((PETAL_COUNT / 2) * theta)),
      PETAL_SHARPNESS
    );
    const r = PETAL_INNER_R + PETAL_AMP * lobe;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const y = STEM_HEIGHT + PETAL_CUP * lobe; // tips curl upward
    positions.push(x, y, z);
    uvs.push(R_PETAL, 0.0);
  }
  for (let i = 0; i < PETAL_PERIMETER; i++) {
    indices.push(
      petalCenterIdx,
      petalCenterIdx + i + 1,
      petalCenterIdx + ((i + 1) % PETAL_PERIMETER) + 1
    );
  }

  // --- Pistil (small olive disc at very center, slightly above petals) ---
  const pistilY = STEM_HEIGHT + PETAL_CUP * 0.4;
  const pistilCenterIdx = positions.length / 3;
  positions.push(0, pistilY, 0);
  uvs.push(R_PISTIL, 1.0);
  for (let i = 0; i < PISTIL_SIDES; i++) {
    const a = (i / PISTIL_SIDES) * Math.PI * 2;
    positions.push(Math.cos(a) * PISTIL_R, pistilY, Math.sin(a) * PISTIL_R);
    uvs.push(R_PISTIL, 0.0);
  }
  for (let i = 0; i < PISTIL_SIDES; i++) {
    indices.push(
      pistilCenterIdx,
      pistilCenterIdx + i + 1,
      pistilCenterIdx + ((i + 1) % PISTIL_SIDES) + 1
    );
  }

  // --- Stamens: 12 small white quads in a ring around the pistil ---
  const stamenY = STEM_HEIGHT + PETAL_CUP * 0.45;
  for (let s = 0; s < STAMEN_COUNT; s++) {
    const a = (s / STAMEN_COUNT) * Math.PI * 2;
    const cx = Math.cos(a) * STAMEN_RING_R;
    const cz = Math.sin(a) * STAMEN_RING_R;
    // tangent direction so the quad is oriented along the ring
    const tx = -Math.sin(a);
    const tz = Math.cos(a);
    const hw = STAMEN_SIZE * 0.5;
    const hl = STAMEN_SIZE * 0.7;
    const base = positions.length / 3;
    // 4 corners (flat quad, slight upward bias on outer edge for "tip")
    positions.push(cx - tx * hw - Math.cos(a) * hl * 0.3, stamenY, cz - tz * hw - Math.sin(a) * hl * 0.3);
    uvs.push(R_STAMEN, 0.0);
    positions.push(cx + tx * hw - Math.cos(a) * hl * 0.3, stamenY, cz + tz * hw - Math.sin(a) * hl * 0.3);
    uvs.push(R_STAMEN, 0.0);
    positions.push(cx + tx * hw + Math.cos(a) * hl * 0.7, stamenY + 0.01, cz + tz * hw + Math.sin(a) * hl * 0.7);
    uvs.push(R_STAMEN, 1.0);
    positions.push(cx - tx * hw + Math.cos(a) * hl * 0.7, stamenY + 0.01, cz - tz * hw + Math.sin(a) * hl * 0.7);
    uvs.push(R_STAMEN, 1.0);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const g = new BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
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
      varying float vRadial;

      void main() {
        vBoost = aBoost;
        vColor = aColor;
        vRegion = uv.x;
        vU = uv.y;
        float horiz = length(position.xz);
        vRadial = 1.0 - smoothstep(0.05, 0.55, horiz);

        vec3 p = position;
        float headMask = smoothstep(0.2, 0.6, position.y);
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
      varying float vRadial;
      uniform float uEmissiveStrength;

      void main() {
        vec3 col;
        if (vRegion < 0.20) {
          // STEM — dark non-emissive green.
          col = vec3(0.022, 0.045, 0.028);
        } else if (vRegion < 0.55) {
          // PETAL — saturated royal blue, slight inner cyan glow toward
          // the cup. Outer petal edges darker (vRadial -> 0).
          vec3 petal = vColor * mix(0.32, 0.55, vRadial);
          // a soft cyan rim where petals meet the center cluster
          vec3 cyan = vec3(0.20, 0.42, 0.75);
          col = mix(petal, cyan, smoothstep(0.55, 0.95, vRadial) * 0.35);
          col *= uEmissiveStrength * (1.0 + vBoost * 1.6);
        } else if (vRegion < 0.85) {
          // PISTIL — olive/khaki with slight greenish-yellow tint.
          col = mix(vec3(0.05, 0.06, 0.025), vec3(0.18, 0.18, 0.06), vRadial);
        } else {
          // STAMEN — cream-white tip (vU=1) fading to pale yellow at base.
          vec3 base = vec3(0.55, 0.50, 0.35);
          vec3 tip  = vec3(1.15, 1.10, 0.95);
          col = mix(base, tip, vU);
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
      const s = 0.7 + Math.random() * 0.5;
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
      baseColor.setHSL(
        0.625 + (Math.random() - 0.5) * 0.035,
        0.95,
        0.42 + Math.random() * 0.08
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
