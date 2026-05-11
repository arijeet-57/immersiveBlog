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
const FIELD_SIZE = 40;
const RIPPLE_RADIUS = 3;
const RIPPLE_HALF_LIFE = 0.4;

// Rounded 5-petal silhouette built from a high-vertex perimeter using
// r(θ) = inner + amplitude * |cos(2.5θ)|^k. Center vertex anchors the
// triangle fan. UV.y = 1 at center, 0 at perimeter — shader uses this
// for the bright white-starburst gradient.
function buildFlowerGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  const PERIMETER = 60;
  const innerR = 0.32;
  const amplitude = 0.78;
  const sharpness = 0.55;

  const positions: number[] = [0, 0, 0];
  const uvs: number[] = [0.5, 1.0];

  for (let i = 0; i < PERIMETER; i++) {
    const theta = (i / PERIMETER) * Math.PI * 2;
    const lobe = Math.pow(Math.abs(Math.cos(2.5 * theta)), sharpness);
    const r = innerR + amplitude * lobe;
    positions.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
    uvs.push(0.5 + Math.cos(theta) * 0.5, 0.0);
  }

  const indices: number[] = [];
  for (let i = 0; i < PERIMETER; i++) {
    indices.push(0, i + 1, ((i + 1) % PERIMETER) + 1);
  }

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
      uEmissiveStrength: { value: 2.4 },
    },
    vertexShader: /* glsl */ `
      attribute float aBoost;
      attribute vec3 aColor;
      attribute float aSeed;
      uniform float uTime;
      varying float vBoost;
      varying vec3 vColor;
      varying float vRadial;

      void main() {
        vBoost = aBoost;
        vColor = aColor;
        vRadial = uv.y;
        vec3 p = position;
        // gentle vertical breath, phase-offset per instance
        p.y += sin(uTime * 1.2 + aSeed * 6.2831) * 0.015;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vBoost;
      varying vec3 vColor;
      varying float vRadial;
      uniform float uEmissiveStrength;

      void main() {
        // Petals are a deeper saturated blue; multiply by 0.9 so they
        // don't blow out bloom — only the center should be HDR-bright.
        vec3 petal = vColor * 0.9;

        // The starburst core: a tight hot white peak (HDR > 1) so bloom
        // turns each center into a luminous point. Cyan-tinted halo
        // between core and petal edges.
        float core   = smoothstep(0.80, 1.00, vRadial);
        float halo   = smoothstep(0.55, 0.90, vRadial);
        vec3 hotWhite = vec3(3.2, 3.4, 3.8);
        vec3 cyan     = vec3(0.55, 0.95, 1.20);

        vec3 col = petal;
        col = mix(col, cyan, halo * 0.6);
        col = mix(col, hotWhite, core);

        col *= uEmissiveStrength * (1.0 + vBoost * 2.5);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
  });
}

export default function FlowerField() {
  const meshRef = useRef<InstancedMesh>(null);
  const positionsRef = useRef(new Float32Array(COUNT * 2)); // xz only
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
      pos.set(x, (Math.random() - 0.5) * 0.05, z);
      positions[i * 2] = x;
      positions[i * 2 + 1] = z;
      e.set(0, Math.random() * Math.PI * 2, 0);
      q.setFromEuler(e);
      const s = 0.35 + Math.random() * 0.25;
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
      // blue with subtle hue jitter (cyan ↔ royal blue), varied brightness
      // Reference flowers are deep saturated royal-blue, not cyan.
      // Hue centered around 0.63 (~ #2230ff range) with small jitter.
      baseColor.setHSL(
        0.625 + (Math.random() - 0.5) * 0.04,
        0.95,
        0.42 + Math.random() * 0.12
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

    // exponential decay with ~0.4s half-life
    const decay = Math.pow(0.5, dt / RIPPLE_HALF_LIFE);
    for (let i = 0; i < boosts.length; i++) boosts[i] *= decay;

    // apply mouse proximity boost
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
          const k = 1 - d2 / r2; // 0..1
          const target = 0.5 * k;
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
      {/* Invisible hover plane — captures pointer position in world space. */}
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
