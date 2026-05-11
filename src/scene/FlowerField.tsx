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

const COUNT = 10_000;
const FIELD_SIZE = 36;
const RIPPLE_RADIUS = 2.4;
const RIPPLE_HALF_LIFE = 0.4;

const STEM_HEIGHT = 0.65;
const STEM_RADIUS = 0.025;
const HEAD_PERIMETER = 30;
const HEAD_INNER_R = 0.30;
const HEAD_AMPLITUDE = 0.78;
const HEAD_SHARPNESS = 0.55;
const HEAD_CUP = 0.18; // petal tips curl up — makes the head 3D, not flat
const STEM_SIDES = 6;

// Single merged geometry: dark-green stem (cylinder, no caps) + cupped
// 5-petal head at the top. Per-vertex `position.y` is later used in the
// fragment shader to branch stem (low y) vs head (high y).
function buildFlowerGeometry(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Stem: two rings (bottom y=0, top y=STEM_HEIGHT)
  for (let ring = 0; ring < 2; ring++) {
    const y = ring === 0 ? 0 : STEM_HEIGHT;
    for (let i = 0; i < STEM_SIDES; i++) {
      const a = (i / STEM_SIDES) * Math.PI * 2;
      positions.push(Math.cos(a) * STEM_RADIUS, y, Math.sin(a) * STEM_RADIUS);
      uvs.push(0.5, 0.0); // unused for stem path
    }
  }
  for (let i = 0; i < STEM_SIDES; i++) {
    const bot1 = i;
    const bot2 = (i + 1) % STEM_SIDES;
    const top1 = STEM_SIDES + i;
    const top2 = STEM_SIDES + ((i + 1) % STEM_SIDES);
    indices.push(bot1, bot2, top2);
    indices.push(bot1, top2, top1);
  }

  // Head: center vertex (UV.y=1) + perimeter vertices (UV.y=0), cupped
  const headCenter = positions.length / 3;
  positions.push(0, STEM_HEIGHT + HEAD_CUP * 0.25, 0);
  uvs.push(0.5, 1.0);

  for (let i = 0; i < HEAD_PERIMETER; i++) {
    const theta = (i / HEAD_PERIMETER) * Math.PI * 2;
    const lobe = Math.pow(Math.abs(Math.cos(2.5 * theta)), HEAD_SHARPNESS);
    const r = HEAD_INNER_R + HEAD_AMPLITUDE * lobe;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const y = STEM_HEIGHT + HEAD_CUP * lobe; // tips curl upward
    positions.push(x, y, z);
    uvs.push(0.5, 0.0);
  }

  for (let i = 0; i < HEAD_PERIMETER; i++) {
    indices.push(
      headCenter,
      headCenter + i + 1,
      headCenter + ((i + 1) % HEAD_PERIMETER) + 1
    );
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
      uEmissiveStrength: { value: 0.55 },
      uStemThreshold: { value: STEM_HEIGHT * 0.85 },
    },
    vertexShader: /* glsl */ `
      attribute float aBoost;
      attribute vec3 aColor;
      attribute float aSeed;
      uniform float uTime;
      varying float vBoost;
      varying vec3 vColor;
      varying float vY;
      varying float vRadial;

      void main() {
        vBoost = aBoost;
        vColor = aColor;
        vY = position.y;
        // vRadial: 1 at center axis, 0 at petal edge. Only meaningful
        // for the head (vY > stem threshold); the fragment branches.
        float horiz = length(position.xz);
        vRadial = 1.0 - smoothstep(0.05, 0.55, horiz);

        vec3 p = position;
        // gentle sway — only the head sways, not the stem
        float headMask = smoothstep(0.2, 0.6, position.y);
        float sway = sin(uTime * 0.9 + aSeed * 6.2831) * 0.012;
        p.x += sway * headMask;
        p.z += cos(uTime * 0.7 + aSeed * 6.2831) * 0.012 * headMask;

        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vBoost;
      varying vec3 vColor;
      varying float vY;
      varying float vRadial;
      uniform float uEmissiveStrength;
      uniform float uStemThreshold;

      void main() {
        vec3 col;
        if (vY < uStemThreshold) {
          // Stem: dark foliage green, NOT emissive — should not bloom.
          col = vec3(0.022, 0.045, 0.028);
        } else {
          // Petal: deep saturated royal blue, dim by default.
          vec3 petal = vColor * 0.42;
          // Cyan halo around the bright core.
          float halo = smoothstep(0.55, 0.92, vRadial);
          vec3 cyan = vec3(0.30, 0.55, 0.80);
          // Hot white core — just bright enough that bloom catches it
          // as a small luminous point per flower, not the whole petal.
          float core = smoothstep(0.88, 1.0, vRadial);
          vec3 hotWhite = vec3(1.30, 1.45, 1.65);

          col = petal;
          col = mix(col, cyan, halo * 0.55);
          col = mix(col, hotWhite, core);
          col *= uEmissiveStrength * (1.0 + vBoost * 1.8);
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
      const yJit = (Math.random() - 0.5) * 0.04;
      pos.set(x, yJit, z);
      positions[i * 2] = x;
      positions[i * 2 + 1] = z;
      // Slight tilt off vertical so the carpet doesn't look like a sheet.
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
      baseColor.setHSL(
        0.625 + (Math.random() - 0.5) * 0.04,
        0.92,
        0.42 + Math.random() * 0.10
      );
      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }

    geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    geometry.setAttribute('aColor', new InstancedBufferAttribute(colors, 3));
    geometry.setAttribute(
      'aBoost',
      new InstancedBufferAttribute(boostsRef.current, 1)
    );
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
          const target = 0.55 * k;
          if (boosts[i] < target) boosts[i] = target;
        }
      }
    }

    const attr = geometry.getAttribute('aBoost') as InstancedBufferAttribute;
    attr.needsUpdate = true;
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
