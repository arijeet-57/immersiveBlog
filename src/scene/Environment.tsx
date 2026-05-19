import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, ShaderMaterial, AdditiveBlending } from 'three';
import { Stars, Clouds, Cloud } from '@react-three/drei';
import * as THREE from 'three';
import Butterfly from './Butterfly';
import { useAppStore } from '../store/appStore';
import { getPalette } from './themePalette';

// Control the mist, clouds, and fog volume and thickness across the environment (0 to 100)
// Mist is kept light — just enough to cloak distant geometry so it fades in
// gracefully as the camera approaches, masking any first-render hitches.
export const MIST_PERCENTAGE = 35;
export const CLOUD_PERCENTAGE = 100;
export const FOG_PERCENTAGE = 10;
export const FOREST_SMOG_PERCENTAGE = 10;
export const MOON_GLOW_PERCENTAGE = 450;

const MIST_COUNT = Math.floor(150 * (MIST_PERCENTAGE / 100));

function AmbientMist() {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const positions = new Float32Array(MIST_COUNT * 3);
    const seeds = new Float32Array(MIST_COUNT * 3);
    for (let i = 0; i < MIST_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 600; // Wide X spread
      positions[i * 3 + 1] = Math.random() * 12; // Near ground to medium height
      positions[i * 3 + 2] = 50 - Math.random() * 500; // Z depth
      seeds[i * 3] = Math.random();
      seeds[i * 3 + 1] = Math.random();
      seeds[i * 3 + 2] = Math.random();
    }
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    g.setAttribute('aSeed', new Float32BufferAttribute(seeds, 3));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uMistIntensity: { value: MIST_PERCENTAGE / 100.0 },
        },
        vertexShader: /* glsl */ `
          attribute vec3 aSeed;
          uniform float uTime;
          uniform float uMistIntensity;
          varying float vAlpha;

          void main() {
            vec3 p = position;
            // Drifting mist
            p.x += sin(uTime * 0.1 + aSeed.x * 6.28) * 15.0 + (uTime * 3.0 * aSeed.y);
            // Wrap around X so mist continuously flows
            p.x = mod(p.x + 300.0, 600.0) - 300.0;
            
            p.y += sin(uTime * 0.05 + aSeed.y * 6.28) * 2.0;
            p.z += cos(uTime * 0.08 + aSeed.z * 6.28) * 5.0;
            
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            // Smaller soft particles than before (was 2000 + 1500). Huge
            // additive sprites torched fillrate via overlap-overdraw; the
            // mist still reads soft because alpha is low and we have
            // many particles.
            gl_PointSize = (1100.0 + aSeed.z * 700.0) / -mv.z;
            
            // Pulsing opacity scaled by the percentage constant
            vAlpha = (0.01 + 0.03 * sin(uTime * 0.2 + aSeed.x * 6.28)) * uMistIntensity;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vAlpha;
          void main() {
            vec2 d = gl_PointCoord - 0.5;
            float dist = length(d);
            if (dist > 0.5) discard;
            // Soft fluffy sphere falloff
            float intensity = smoothstep(0.5, 0.0, dist);
            intensity = pow(intensity, 1.5); // Thicken center slightly
            
            vec3 mistColor = vec3(0.35, 0.55, 0.85); // Magical blue
            gl_FragColor = vec4(mistColor * intensity * vAlpha, intensity * vAlpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    []
  );

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

function SkyClouds() {
  // Suppress the night-tinted volumetric clouds in dawn/day — those themes
  // ship their own atmospheric cloud bands.
  const theme = useAppStore((s) => s.theme);
  if (theme !== 'night') return null;
  if (CLOUD_PERCENTAGE <= 0) return null;
  const cloudCount = Math.floor(10 * (CLOUD_PERCENTAGE / 100));

  return (
    <Clouds material={THREE.MeshBasicMaterial}>
      {Array.from({ length: cloudCount }).map((_, i) => (
        <Cloud
          key={i}
          seed={i + 1}
          position={[
            (Math.random() - 0.5) * 400,
            120 + Math.random() * 60,
            -100 - Math.random() * 300,
          ]}
          volume={15}
          color="#2a4b70"
          opacity={0.3 * (CLOUD_PERCENTAGE / 100)}
          speed={0.1}
        />
      ))}
    </Clouds>
  );
}

export default function Environment() {
  const theme = useAppStore((s) => s.theme);
  const palette = getPalette(theme);

  // Light "cloak" fog: near objects render clear, distant geometry fades
  // into haze. Fog far is wider in day mode (the haze is lighter / further).
  const fogNear = 40;
  const fogFar  =
    theme === 'day' ? 260 :
    theme === 'dawn' ? 130 :
    180;

  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <ambientLight intensity={palette.ambient} />
      {palette.fill > 0 && (
        <hemisphereLight
          args={[palette.sky, palette.ground, palette.fill]}
        />
      )}
      <fog attach="fog" args={[palette.fog, fogNear, fogFar]} />
      <AmbientMist />
      <SkyClouds />
      {palette.stars && (
        <Stars radius={500} depth={80} count={900} factor={3} fade speed={0.4} />
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} renderOrder={-1}>
        <planeGeometry args={[2000, 2000]} />
        {/* depthWrite must be ON — otherwise the ground doesn't occlude the
            flower stems / foliage roots beneath it and you can see through
            into the negative-Y void. */}
        <meshBasicMaterial color={palette.ground} toneMapped={false} fog />
      </mesh>
    </>
  );
}
