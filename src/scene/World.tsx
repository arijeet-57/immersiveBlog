import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useRef } from 'react';
import type { Mesh } from 'three';
import PostFX from './PostFX';

function TestCube() {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.x += dt * 0.3;
    ref.current.rotation.y += dt * 0.5;
  });
  return (
    <mesh ref={ref} position={[0, 0, 0]}>
      <boxGeometry args={[1.2, 1.2, 1.2]} />
      <meshStandardMaterial
        color="#0a1a2e"
        emissive="#3aa8ff"
        emissiveIntensity={2.2}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  );
}

export default function World() {
  return (
    <Canvas
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
      camera={{ position: [0, 0, 4], fov: 45, near: 0.1, far: 1000 }}
      style={{ position: 'fixed', inset: 0, background: '#000' }}
    >
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.15} />
      <Suspense fallback={null}>
        <TestCube />
        <PostFX />
      </Suspense>
    </Canvas>
  );
}
