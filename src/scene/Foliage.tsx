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

const FIELD_SIZE = 40;
const GRASS_COUNT = 5000;
const LEAF_COUNT = 1800;

function buildBladeGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  const positions = new Float32Array([
    -0.5, 0.0, 0,
     0.5, 0.0, 0,
     0.1, 1.0, 0,
    -0.1, 1.0, 0,
  ]);
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeBoundingSphere();
  return g;
}

function buildLeafGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  const positions = new Float32Array([
    0, 0, 0,
    0, 0, -0.5,
    0.4, 0, -0.15,
    -0.4, 0, -0.15,
    0, 0, 0.4,
  ]);
  const uvs = new Float32Array([0.5, 0.5, 0.5, 1, 1, 0.5, 0, 0.5, 0.5, 0]);
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex([0, 1, 2, 0, 3, 1, 0, 2, 4, 0, 4, 3]);
  g.computeBoundingSphere();
  return g;
}

function buildFoliageMaterial(base: Color): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBase: { value: new Vector3(base.r, base.g, base.b) },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      varying float vY;
      varying float vSeed;
      void main() {
        vY = position.y;
        vSeed = aSeed;
        vec3 p = position;
        float sway = sin(uTime * 0.6 + aSeed * 6.28) * 0.06 * position.y;
        p.x += sway;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vY;
      varying float vSeed;
      uniform vec3 uBase;
      void main() {
        vec3 col = uBase * (0.75 + 0.5 * vSeed);
        col = mix(col, col * 1.4, smoothstep(0.7, 1.0, vY));
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
  yJitter: number
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

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * FIELD_SIZE;
      const z = (Math.random() - 0.5) * FIELD_SIZE;
      const y = (Math.random() - 0.5) * yJitter;
      pos.set(x, y, z);
      const pitch = (Math.random() - 0.5) * 0.4;
      const yaw = Math.random() * Math.PI * 2;
      const roll = (Math.random() - 0.5) * 0.4;
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
  }, [meshRef, geometry, count, scaleRange, yJitter]);
}

function Grass() {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => buildBladeGeometry(), []);
  const material = useMemo(
    () => buildFoliageMaterial(new Color(0.04, 0.10, 0.05)),
    []
  );
  useScatter(ref, geometry, GRASS_COUNT, [0.12, 0.3], 0);
  useFrame((state) => {
    (material.uniforms.uTime as { value: number }).value = state.clock.elapsedTime;
  });
  return <instancedMesh ref={ref} args={[geometry, material, GRASS_COUNT]} frustumCulled={false} />;
}

function Leaves() {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => buildLeafGeometry(), []);
  const material = useMemo(
    () => buildFoliageMaterial(new Color(0.03, 0.08, 0.04)),
    []
  );
  useScatter(ref, geometry, LEAF_COUNT, [0.35, 0.7], 0.02);
  useFrame((state) => {
    (material.uniforms.uTime as { value: number }).value = state.clock.elapsedTime;
  });
  return <instancedMesh ref={ref} args={[geometry, material, LEAF_COUNT]} frustumCulled={false} />;
}

export default function Foliage() {
  return (
    <>
      <Leaves />
      <Grass />
    </>
  );
}
