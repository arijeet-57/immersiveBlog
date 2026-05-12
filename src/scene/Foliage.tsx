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

const FOLIAGE_VISIBLE_TO = 0.70;

const FIELD_SIZE = 40;
const GRASS_COUNT = 6000;
const LEAF_COUNT = 3000;
const TWIG_COUNT = 1220;

// --- Grass blade: curved 3D ribbon, slightly tapered, with a tip curl ---
function buildBladeGeometry(): BufferGeometry {
  const SEGS = 6;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= SEGS; i++) {
    const v = i / SEGS;
    // width tapers to a point at the tip
    const halfW = 0.06 * (1 - v) + 0.005;
    // slight curve in Z so the blade isn't flat
    const z = Math.sin(v * Math.PI) * 0.05;
    positions.push(-halfW, v, z);
    uvs.push(0, v);
    positions.push(halfW, v, z);
    uvs.push(1, v);
  }
  for (let i = 0; i < SEGS; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, d, a, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// --- Leaf: tessellated 3-lobed shape, slightly cupped ---
function buildLeafGeometry(): BufferGeometry {
  const SEG_V = 6;
  const SEG_U = 4;
  const LEAF_LEN = 0.9;
  const LEAF_CUP = 0.04;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= SEG_V; row++) {
    const v = row / SEG_V;
    // 3 visible bumps along the length via combined sines
    const base = Math.sin(v * Math.PI);
    const lobes = 0.5 + 0.5 * Math.cos(v * Math.PI * 3.0);
    const halfW = 0.35 * base * (0.55 + 0.45 * lobes);
    for (let col = 0; col <= SEG_U; col++) {
      const u = col / SEG_U;
      const localX = (u - 0.5) * 2 * halfW;
      const localZ = (v - 0.5) * LEAF_LEN;
      const cup = (1.0 - Math.abs(2 * (u - 0.5))) * base;
      const localY = LEAF_CUP * cup;
      positions.push(localX, localY, localZ);
      uvs.push(u, v);
    }
  }
  const cols = SEG_U + 1;
  for (let row = 0; row < SEG_V; row++) {
    for (let col = 0; col < SEG_U; col++) {
      const a = row * cols + col;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// --- Twig: short tapered cylinder with a slight bend ---
function buildTwigGeometry(): BufferGeometry {
  const SEG_LEN = 8;
  const SIDES = 5;
  const LEN = 0.5;
  const BASE_R = 0.018;
  const TIP_R = 0.006;
  const BEND = 0.08;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= SEG_LEN; i++) {
    const v = i / SEG_LEN;
    const r = BASE_R * (1 - v) + TIP_R * v;
    const bend = Math.sin(v * Math.PI) * BEND;
    for (let j = 0; j < SIDES; j++) {
      const a = (j / SIDES) * Math.PI * 2;
      positions.push(Math.cos(a) * r + bend, v * LEN, Math.sin(a) * r);
      uvs.push(j / SIDES, v);
    }
  }
  for (let i = 0; i < SEG_LEN; i++) {
    for (let j = 0; j < SIDES; j++) {
      const a = i * SIDES + j;
      const b = i * SIDES + ((j + 1) % SIDES);
      const c = (i + 1) * SIDES + j;
      const d = (i + 1) * SIDES + ((j + 1) % SIDES);
      indices.push(a, b, d, a, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function buildFoliageMaterial(base: Color, tipBoost = 1.4, sway = 0.06): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBase: { value: new Vector3(base.r, base.g, base.b) },
      uTipBoost: { value: tipBoost },
      uSway: { value: sway },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uSway;
      varying float vY;
      varying float vSeed;
      varying vec3 vNormal;
      void main() {
        vY = position.y;
        vSeed = aSeed;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        float swayAmt = sin(uTime * 0.6 + aSeed * 6.28) * uSway * position.y;
        p.x += swayAmt;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vY;
      varying float vSeed;
      varying vec3 vNormal;
      uniform vec3 uBase;
      uniform float uTipBoost;
      void main() {
        vec3 col = uBase * (0.70 + 0.6 * vSeed);
        col = mix(col, col * uTipBoost, smoothstep(0.6, 1.0, vY));
        float face = clamp(vNormal.y, 0.0, 1.0);
        col *= mix(0.85, 1.10, face);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
  });
}

function useScatter(
  meshRef: React.RefObject<InstancedMesh>,
  geometry: BufferGeometry,
  count: number,
  scaleRange: [number, number],
  yJitter: number,
  tiltAmount = 0.4
) {
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new Matrix4();
    const pos = new Vector3();
    const q = new Quaternion();
    const e = new Euler();
    const scale = new Vector3();
    const seeds = new Float32Array(count);

    // River basin sits at z ≈ -25 with a ~18-wide wet strip. Keep foliage
    // out of that zone so grass/leaves/twigs don't poke through the water
    // surface. Resample if the candidate falls inside the bank.
    const RIVER_Z = -25;
    const BANK_HALF = 10; // 1-unit margin past the basin's visible edge
    for (let i = 0; i < count; i++) {
      let x = 0;
      let z = 0;
      for (let tries = 0; tries < 8; tries++) {
        x = (Math.random() - 0.5) * FIELD_SIZE;
        z = (Math.random() - 0.5) * FIELD_SIZE;
        if (Math.abs(z - RIVER_Z) > BANK_HALF) break;
      }
      if (Math.abs(z - RIVER_Z) <= BANK_HALF) {
        // Push the stragglers to the field side of the bank.
        z = RIVER_Z + BANK_HALF + Math.random() * 2;
      }
      const y = (Math.random() - 0.5) * yJitter;
      pos.set(x, y, z);
      const pitch = (Math.random() - 0.5) * tiltAmount;
      const yaw = Math.random() * Math.PI * 2;
      const roll = (Math.random() - 0.5) * tiltAmount;
      e.set(pitch, yaw, roll, 'YXZ');
      q.setFromEuler(e);
      const s = scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0]);
      scale.set(s, s, s);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
      seeds[i] = Math.random();
    }
    mesh.instanceMatrix.needsUpdate = true;
    geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
  }, [meshRef, geometry, count, scaleRange, yJitter, tiltAmount]);
}

function Grass() {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => buildBladeGeometry(), []);
  const material = useMemo(
    () => buildFoliageMaterial(new Color(0.05, 0.13, 0.07), 1.5, 0.10),
    []
  );
  useScatter(ref, geometry, GRASS_COUNT, [0.18, 0.42], 0, 0.18);
  useFrame((state) => {
    (material.uniforms.uTime as { value: number }).value = state.clock.elapsedTime;
  });
  return <instancedMesh ref={ref} args={[geometry, material, GRASS_COUNT]} frustumCulled={false} />;
}

function Leaves() {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => buildLeafGeometry(), []);
  const material = useMemo(
    () => buildFoliageMaterial(new Color(0.04, 0.10, 0.05), 1.25, 0.02),
    []
  );
  useScatter(ref, geometry, LEAF_COUNT, [0.4, 0.85], 0.02, 0.5);
  useFrame((state) => {
    (material.uniforms.uTime as { value: number }).value = state.clock.elapsedTime;
  });
  return <instancedMesh ref={ref} args={[geometry, material, LEAF_COUNT]} frustumCulled={false} />;
}

function Twigs() {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => buildTwigGeometry(), []);
  const material = useMemo(
    () => buildFoliageMaterial(new Color(0.08, 0.06, 0.04), 1.15, 0.0),
    []
  );
  useScatter(ref, geometry, TWIG_COUNT, [0.6, 1.4], 0.005, 0.9);
  useFrame((state) => {
    (material.uniforms.uTime as { value: number }).value = state.clock.elapsedTime;
  });
  return <instancedMesh ref={ref} args={[geometry, material, TWIG_COUNT]} frustumCulled={false} />;
}

export default function Foliage() {
  const groupRef = useRef<Group>(null);
  useFrame(() => {
    const s = useAppStore.getState().scrollProgress;
    if (groupRef.current) groupRef.current.visible = s <= FOLIAGE_VISIBLE_TO;
  });
  return (
    <group ref={groupRef}>
      <Twigs />
      <Leaves />
      <Grass />
    </group>
  );
}
