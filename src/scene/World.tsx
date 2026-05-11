import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import PostFX from './PostFX';
import CameraRig from './CameraRig';
import Environment from './Environment';
import FlowerField from './FlowerField';
import Fireflies from './Fireflies';

export default function World() {
  return (
    <Canvas
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
      camera={{ position: [0, 80, 0], fov: 45, near: 0.1, far: 1000 }}
      style={{ position: 'fixed', inset: 0, background: '#000' }}
    >
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.15} />
      <Suspense fallback={null}>
        <CameraRig />
        <Environment />
        <FlowerField />
        <Fireflies />
        <PostFX />
      </Suspense>
    </Canvas>
  );
}
