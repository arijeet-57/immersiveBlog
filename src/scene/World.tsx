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
import Sun, { SUN_POS } from './Sun';
import SunsetSky, { SUNSET_SUN_POS } from './SunsetSky';
import DaySky from './DaySky';
import Butterfly from './Butterfly';
import ButterflyTrail from './ButterflyTrail';
import { useAppStore } from '../store/appStore';
import { getPalette } from './themePalette';

function ThemedMoon() {
  const theme = useAppStore((s) => s.theme);
  if (!getPalette(theme).moon) return null;
  return <Moon />;
}

function ThemedFireflies() {
  // Fireflies only really read in the dark.
  const theme = useAppStore((s) => s.theme);
  if (theme === 'day') return null;
  return <Fireflies />;
}

function ThemedSun() {
  const theme = useAppStore((s) => s.theme);
  if (theme !== 'day') return null;
  return (
    <>
      <DaySky />
      <Sun />
      {/* Directional light from the sun's direction — actually brightens
          surfaces (foliage, valley, ground). Warm-white to match the disc tint. */}
      <directionalLight position={SUN_POS} intensity={1.8} color="#fff2d8" />
    </>
  );
}

function ThemedSunset() {
  const theme = useAppStore((s) => s.theme);
  if (theme !== 'dawn') return null;
  return (
    <>
      <SunsetSky />
      {/* Low warm directional light coming from the setting sun — gives the
          scene the long-shadow red-tinted feel of golden hour. */}
      <directionalLight position={SUNSET_SUN_POS} intensity={1.1} color="#ff8a4a" />
    </>
  );
}

export default function World() {
  return (
    <Canvas
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, depth: true }}
      dpr={[0.75, 1.5]}
      performance={{ min: 0.5 }}
      camera={{ position: [0, 15, 0], fov: 45, near: 0.05, far: 1000 }}
      style={{ position: 'fixed', inset: 0 }}
    >
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
        <ThemedMoon />
        <ThemedSun />
        <ThemedSunset />
        <ThemedFireflies />
        <PostFX />
      </Suspense>
    </Canvas>
  );
}
