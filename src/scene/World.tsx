import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import PostFX from './PostFX';
import CameraRig from './CameraRig';
import Environment from './Environment';
import FlowerField from './FlowerField';
import Foliage from './Foliage';
import Fireflies from './Fireflies';
import BiolumeRiver from './BiolumeRiver';
import DarkForest from './DarkForest';
import Valley from './Valley';
import Moon from './Moon';
import Butterfly from './Butterfly';
import ButterflyTrail from './ButterflyTrail';

export default function World() {
  return (
    <Canvas
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
      camera={{ position: [0, 15, 0], fov: 45, near: 0.05, far: 1000 }}
      style={{ position: 'fixed', inset: 0, background: '#0a1530' }}
    >
      <color attach="background" args={['#0a1530']} />
      <ambientLight intensity={0.15} />
      <Suspense fallback={null}>
        <CameraRig />
        
        {/* POV Avatar + bioluminescent dust trail */}
        <Butterfly interactive flapSpeed={12.0} scale={0.08} />
        <ButterflyTrail />

        <Environment />
        <Foliage />
        <FlowerField />
        <BiolumeRiver />
        <DarkForest />
        <Valley />
        <Moon />
        <Fireflies />
        <PostFX />
      </Suspense>
    </Canvas>
  );
}
