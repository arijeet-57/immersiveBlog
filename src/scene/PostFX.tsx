import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { BloomEffect } from 'postprocessing';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '../store/appStore';
import { getPalette } from './themePalette';

// Bloom baseline is theme-dependent — at night & dawn we want plenty of
// glow on biolume; in daylight we tone bloom way down or everything
// looks blown out.
const BLOOM_BASE = 0.40;
const BLOOM_BRIDGE_PEAK = 0.95;
const BRIDGE_START = 0.60;
const BRIDGE_PEAK = 0.68;
const BRIDGE_END = 0.76;

// Moonrise: bloom swells as the camera breaks the canopy and the moon
// dominates the upper third of the frame.
const BLOOM_MOON_PEAK = 0.56;
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
    const state = useAppStore.getState();
    const s = state.scrollProgress;
    const base = getPalette(state.theme).bloomBase;
    const bridgeK = smoothstep01(triangle(s, BRIDGE_START, BRIDGE_PEAK, BRIDGE_END));
    const moonK = smoothstep01(
      Math.max(0, Math.min(1, (s - MOON_START) / (MOON_END - MOON_START)))
    );
    const bridgeContrib = (BLOOM_BRIDGE_PEAK - base) * bridgeK;
    const moonContrib = (BLOOM_MOON_PEAK - base) * moonK;
    eff.intensity = base + Math.max(bridgeContrib, moonContrib);
  });
  return null;
}

export default function PostFX() {
  // GodRays was removed: the postprocessing library's screen-space radial
  // blur composited the moon's bright pixels additively over the final
  // scene, ignoring depth — which created a "ghost moon" visible through
  // tree trunks. The forest mist + bloom alone read as atmospheric volume.
  const bloomRef = useRef<BloomEffect>(null);

  return (
    <>
      <EffectComposer multisampling={0}>
        <Bloom
          ref={bloomRef as unknown as React.Ref<typeof BloomEffect>}
          intensity={BLOOM_BASE}
          luminanceThreshold={1.05}
          luminanceSmoothing={0.4}
          mipmapBlur
        />
      </EffectComposer>
      <BloomController bloomRef={bloomRef} />
    </>
  );
}
