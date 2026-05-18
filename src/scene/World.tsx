import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { AdaptiveEvents, PerformanceMonitor, Preload } from '@react-three/drei';
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
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, depth: true }}
      dpr={[0.5, 2]}
      performance={{ min: 0.5 }}
      camera={{ position: [0, 15, 0], fov: 45, near: 0.05, far: 1000 }}
      style={{ position: 'fixed', inset: 0, background: '#0a1530' }}
    >
      <color attach="background" args={['#0a1530']} />
      <ambientLight intensity={0.15} />
      <Suspense fallback={null}>
        {/* Auto-adapt resolution when framerate drops. Tuned to ignore
            the inevitable first-second shader-compile spike so we don't
            permanently downscale DPR after startup jank. `pixelated` is
            off — nearest-neighbor scaling reads as a visible quality
            drop during transient stalls. */}
        <PerformanceMonitor
          ms={500}
          iterations={6}
          threshold={0.75}
          bounds={(refreshrate) => [refreshrate * 0.4, refreshrate * 0.85]}
          flipflops={2}
        />
        <AdaptiveEvents />
        {/* Compile every material/geometry in the scene before the user
            scrolls. Without this, materials only compile when first
            entering the frustum — causing the staggered "everything
            renders slowly when you start scrolling" stutter as river,
            forest, valley each hit a compile spike in turn. */}
        <Preload all />

        <CameraRig />
        
        {/* POV Avatar + bioluminescent dust trail */}
        <Butterfly interactive flapSpeed={12.0} scale={0.088} />
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
