import { EffectComposer, Bloom, GodRays } from '@react-three/postprocessing';
import { BloomEffect } from 'postprocessing';
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';
import { subscribeSun } from './sunRef';
import { useAppStore } from '../store/appStore';

// Bloom intensity baseline and the "bridge moment" peak as the camera flies
// directly over the widened section of the river at scroll ≈ 0.68.
const BLOOM_BASE = 0.75;
const BLOOM_BRIDGE_PEAK = 1.45;
const BRIDGE_START = 0.60;
const BRIDGE_PEAK = 0.68;
const BRIDGE_END = 0.76;

// Moonrise: bloom swells as the camera breaks the canopy and the moon
// dominates the upper third of the frame.
const BLOOM_MOON_PEAK = 2.0;
const MOON_START = 0.85;
const MOON_END = 1.0;

function triangle(t: number, a: number, peak: number, b: number): number {
  if (t <= a || t >= b) return 0;
  if (t < peak) return (t - a) / (peak - a);
  return 1 - (t - peak) / (b - peak);
}

function smoothstep01(k: number): number {
  return k * k * (3 - 2 * k);
}

// The Bloom ref type from @react-three/postprocessing is mistyped as
// `typeof BloomEffect` (the class) instead of an instance; we coerce to any.
type BloomRef = React.MutableRefObject<BloomEffect | null>;

function BloomController({ bloomRef }: { bloomRef: BloomRef }) {
  useFrame(() => {
    const eff = bloomRef.current;
    if (!eff) return;
    const s = useAppStore.getState().scrollProgress;
    const bridgeK = smoothstep01(triangle(s, BRIDGE_START, BRIDGE_PEAK, BRIDGE_END));
    const moonK = smoothstep01(
      Math.max(0, Math.min(1, (s - MOON_START) / (MOON_END - MOON_START)))
    );
    const bridgeContrib = (BLOOM_BRIDGE_PEAK - BLOOM_BASE) * bridgeK;
    const moonContrib = (BLOOM_MOON_PEAK - BLOOM_BASE) * moonK;
    eff.intensity = BLOOM_BASE + Math.max(bridgeContrib, moonContrib);
  });
  return null;
}

export default function PostFX() {
  // The moon (from <Environment />) doubles as the GodRays light source —
  // a separate emitter mesh would render as a visible "second moon".
  const [sun, setSun] = useState<Mesh | null>(null);
  useEffect(() => subscribeSun(setSun), []);
  const bloomRef = useRef<BloomEffect>(null);

  return (
    <>
      <EffectComposer multisampling={0} key={sun ? 'with-rays' : 'no-rays'}>
        {sun ? (
          <>
            <Bloom
              ref={bloomRef as unknown as React.Ref<typeof BloomEffect>}
              intensity={BLOOM_BASE}
              luminanceThreshold={0.85}
              luminanceSmoothing={0.4}
              mipmapBlur
            />
            <GodRays
              sun={sun}
              samples={30}
              density={0.94}
              decay={0.94}
              weight={0.32}
              exposure={0.30}
              clampMax={1.0}
              blur
            />
          </>
        ) : (
          <Bloom
            ref={bloomRef as unknown as React.Ref<typeof BloomEffect>}
            intensity={BLOOM_BASE}
            luminanceThreshold={0.85}
            luminanceSmoothing={0.4}
            mipmapBlur
          />
        )}
      </EffectComposer>
      <BloomController bloomRef={bloomRef} />
    </>
  );
}
