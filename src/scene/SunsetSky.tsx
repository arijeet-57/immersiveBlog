import { useMemo, useRef } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  DoubleSide,
  NormalBlending,
  ShaderMaterial,
} from 'three';

// Dawn / sunset sky:
//   - A large warm-red/orange sun sitting low on the horizon.
//   - Stratified sunset cloud bands (deep red near horizon → bright orange
//     mid → soft gold up high) built as billboarded soft-edged planes
//     with multi-octave fbm shape — reads as real horizontal cloud streaks.

const SUNSET_SUN_POS: [number, number, number] = [0, 70, -500];
const SUN_DISC_SIZE = 90;
const SUN_HALO_SIZE = 360;

// ── Sun disc + halo ──────────────────────────────────────────────────────
function buildSunsetDiscMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vec2 d = vUv - 0.5;
        float r = length(d) * 2.0;
        if (r > 1.0) discard;

        float hot   = smoothstep(0.30, 0.05, r);
        float warm  = smoothstep(1.00, 0.25, r);
        vec3 gold   = vec3(1.00, 0.82, 0.40);
        vec3 orange = vec3(1.00, 0.50, 0.18);
        vec3 red    = vec3(0.85, 0.22, 0.10);

        vec3 col = mix(red, orange, warm);
        col      = mix(col, gold, hot * 0.85);
        float alpha = max(hot, warm);
        gl_FragColor = vec4(col * 2.0, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

function buildSunsetHaloMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vec2 d = vUv - 0.5;
        float r = length(d) * 2.0;
        if (r > 1.0) discard;

        float halo = pow(max(0.0, 1.0 - r), 2.6);
        float horiz = 1.0 - abs(d.y) * 0.4;
        halo *= horiz;

        // Clip the halo well above the ground plane so it never paints a
        // glowing band along the horizon line.
        float horizonFade = smoothstep(20.0, 55.0, vWorldPos.y);
        halo *= horizonFade;

        vec3 warm  = vec3(1.00, 0.55, 0.28);
        vec3 inner = vec3(1.00, 0.78, 0.46);
        vec3 col = mix(warm, inner, smoothstep(0.6, 1.0, halo));

        gl_FragColor = vec4(col * 1.3, halo * 0.95);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

// ── Sunset cloud material ────────────────────────────────────────────────
// FBM-driven density shape with feathered edges. Color varies vertically:
// dark red at the cloud's bottom (in shadow), bright sunlit warm tones on
// the top edge — that's the giveaway look of a sunset cloud.
function buildCloudMaterial(opts: {
  topColor: [number, number, number];
  midColor: [number, number, number];
  bottomColor: [number, number, number];
  uShift: number;
  density: number;        // 0–1, how filled the cloud is
  brightnessBoost: number;
}): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uShift:           { value: opts.uShift },
      uDensity:         { value: opts.density },
      uTopColor:        { value: opts.topColor },
      uMidColor:        { value: opts.midColor },
      uBottomColor:     { value: opts.bottomColor },
      uBrightnessBoost: { value: opts.brightnessBoost },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uShift;
      uniform float uDensity;
      uniform float uBrightnessBoost;
      uniform vec3  uTopColor;
      uniform vec3  uMidColor;
      uniform vec3  uBottomColor;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i),               hash(i + vec2(1, 0)), f.x),
          mix(hash(i + vec2(0, 1)),  hash(i + vec2(1, 1)), f.x),
          f.y);
      }
      // 2-octave fbm (was 4)
      float fbm(vec2 p) {
        float v = vnoise(p) * 0.6;
        v += vnoise(p * 2.0) * 0.3;
        return v;
      }

      void main() {
        // Anisotropic UV — squash vertical noise so clouds stretch horizontally
        vec2 uv = vec2(vUv.x * 4.0 + uShift, vUv.y * 1.5);

        // Cloud body density
        float n = fbm(uv);
        // Cloud outline shape — bigger near center, fades at edges
        float horizMask = smoothstep(0.02, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float vertMask  = smoothstep(0.05, 0.32, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
        float mask = horizMask * vertMask;

        // Threshold the noise to create cloud blobs; soft edges via smoothstep
        float thresh = mix(0.65, 0.35, uDensity);
        float density = smoothstep(thresh, thresh - 0.18, 1.0 - n);
        density *= mask;

        // Vertical color blend within the cloud — top is sunlit, bottom is shaded
        vec3 col;
        if (vUv.y > 0.55) {
          col = mix(uMidColor, uTopColor, smoothstep(0.55, 0.95, vUv.y));
        } else {
          col = mix(uBottomColor, uMidColor, smoothstep(0.05, 0.55, vUv.y));
        }

        // Subtle internal density variation also brightens highlights
        float bright = smoothstep(0.5, 0.85, n);
        col += uTopColor * bright * 0.25;

        // Sun-side rim glow — cloud edges nearest sun glow brighter
        float rim = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 1.6);
        col += vec3(1.0, 0.55, 0.25) * rim * 0.30;

        col *= uBrightnessBoost;

        float alpha = density;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
    toneMapped: false,
  });
}

// Layer spec: position + size + per-layer tint/density.
type Strip = {
  x: number; y: number; z: number;
  w: number; h: number;
  shift: number;
  density: number;
  bright: number;
  top: [number, number, number];
  mid: [number, number, number];
  bot: [number, number, number];
};

const STRIPS: Strip[] = [
  // (Removed: dense red horizon-line bands — they read as a hard horizon
  // strip across the ground. Sunset now lives entirely above the skyline.)

  // Middle band — bright orange.
  { x: -40, y: 78, z: -470, w: 300, h: 22, shift: 3.4, density: 0.75, bright: 1.1,
    top: [1.00, 0.78, 0.40], mid: [1.00, 0.55, 0.22], bot: [0.72, 0.24, 0.12] },
  { x: 140, y: 86, z: -465, w: 220, h: 18, shift: 5.1, density: 0.65, bright: 1.05,
    top: [1.00, 0.78, 0.40], mid: [1.00, 0.52, 0.20], bot: [0.65, 0.18, 0.10] },

  // Top band — gold, wispy, catching the last light.
  { x:   0, y: 118, z: -475, w: 280, h: 16, shift: 6.8, density: 0.55, bright: 1.1,
    top: [1.00, 0.92, 0.60], mid: [1.00, 0.75, 0.35], bot: [0.80, 0.40, 0.18] },
  { x:-100, y: 132, z: -470, w: 200, h: 14, shift: 8.5, density: 0.45, bright: 1.0,
    top: [1.00, 0.92, 0.60], mid: [1.00, 0.72, 0.32], bot: [0.70, 0.32, 0.15] },
];

export default function SunsetSky() {
  const discMat = useMemo(() => buildSunsetDiscMaterial(), []);
  const haloMat = useMemo(() => buildSunsetHaloMaterial(), []);
  const cloudMats = useMemo(
    () =>
      STRIPS.map((s) =>
        buildCloudMaterial({
          uShift: s.shift,
          density: s.density,
          brightnessBoost: s.bright,
          topColor: s.top,
          midColor: s.mid,
          bottomColor: s.bot,
        }),
      ),
    [],
  );
  const tRef = useRef(0);

  useFrame((_, dt) => {
    tRef.current += dt * 0.04;
    for (let i = 0; i < cloudMats.length; i++) {
      cloudMats[i].uniforms.uShift.value = STRIPS[i].shift + tRef.current;
    }
  });

  return (
    <>
      <Billboard position={SUNSET_SUN_POS}>
        <mesh material={haloMat} renderOrder={1}>
          <planeGeometry args={[SUN_HALO_SIZE, SUN_HALO_SIZE]} />
        </mesh>
        <mesh material={discMat} renderOrder={2} position={[0, 0, 0.01]}>
          <planeGeometry args={[SUN_DISC_SIZE, SUN_DISC_SIZE]} />
        </mesh>
      </Billboard>

      {STRIPS.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, s.y, s.z]}
          material={cloudMats[i]}
          renderOrder={1}
        >
          <planeGeometry args={[s.w, s.h]} />
        </mesh>
      ))}
    </>
  );
}

export { SUNSET_SUN_POS };
