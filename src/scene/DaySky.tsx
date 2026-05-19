import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DoubleSide,
  NormalBlending,
  ShaderMaterial,
} from 'three';

// Daytime sky furniture: scattered cumulus cloud planes. The sky itself is
// the flat canvas clear color set by the theme palette — that color is
// also used by the fog so the ground fades into it at distance, giving a
// seamless horizon. A vertical gradient backdrop was tried but its color
// space didn't match the renderer's sRGB output, producing a faint
// horizon seam — leaving it as flat fixes the seam.

// ── Daytime cumulus cloud material ───────────────────────────────────────
// White cloud body with sunlit-top / shadow-bottom shading. fbm gives the
// puffy outline. Slow horizontal drift.
function buildCumulusMaterial(opts: {
  seed: number;
  density: number;
  scale: number;
}): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime:    { value: 0 },
      uSeed:    { value: opts.seed },
      uDensity: { value: opts.density },
      uScale:   { value: opts.scale },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uSeed;
      uniform float uDensity;
      uniform float uScale;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i),               hash(i + vec2(1, 0)), f.x),
          mix(hash(i + vec2(0, 1)),  hash(i + vec2(1, 1)), f.x),
          f.y);
      }
      // 3-octave fbm (was 5). Clouds still read as puffy — the top two
      // octaves were tiny grain that mostly aliased out anyway.
      float fbm(vec2 p) {
        float v = vnoise(p) * 0.5;
        v += vnoise(p * 2.0) * 0.25;
        v += vnoise(p * 4.0) * 0.125;
        return v;
      }

      void main() {
        // Slow drift along x. Vertical noise is squashed so clouds look
        // wider than tall (cumulus shapes).
        vec2 uv = vec2(vUv.x * uScale + uSeed + uTime * 0.03,
                       vUv.y * uScale * 0.55 + uSeed * 0.7);

        float n = fbm(uv);
        // Cloud outline mask — softer than sunset clouds (more rounded)
        float horizMask = smoothstep(0.05, 0.28, vUv.x) * smoothstep(1.0, 0.72, vUv.x);
        float vertMask  = smoothstep(0.05, 0.32, vUv.y) * smoothstep(1.0, 0.68, vUv.y);
        float mask = horizMask * vertMask;

        // Density threshold — softer falloff for puffier edges.
        float thresh = mix(0.62, 0.32, uDensity);
        float density = smoothstep(thresh, thresh - 0.22, 1.0 - n);
        density *= mask;

        // Vertical shading — sunlit highlight at top, very gentle shadow
        // underneath. Bias the whole palette to a clean white so the
        // clouds read as pleasant cumulus, not grey overcast.
        vec3 highlight = vec3(1.00, 1.00, 1.00);  // pure white top
        vec3 mid       = vec3(0.98, 0.98, 0.99);  // near-white body
        vec3 shadow    = vec3(0.84, 0.86, 0.90);  // very light cool underside

        vec3 col;
        if (vUv.y > 0.55) {
          col = mix(mid, highlight, smoothstep(0.55, 0.95, vUv.y));
        } else {
          col = mix(shadow, mid, smoothstep(0.05, 0.55, vUv.y));
        }

        // Internal density highlights — denser parts of the cloud catch
        // more light, giving the "puffy" 3D look.
        float bright = smoothstep(0.55, 0.92, n);
        col += highlight * bright * 0.18;

        if (density < 0.01) discard;
        gl_FragColor = vec4(col, density);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
    toneMapped: false,
  });
}

// Cloud spec: position, size, shader params.
type Cumulus = {
  x: number; y: number; z: number;
  w: number; h: number;
  seed: number; density: number; scale: number;
};

// Spread cumulus clouds across the sky at varied depths and altitudes.
// Scattered along the entire camera path so there are pleasant clouds
// overhead at every scroll position, not just one section.
const CLOUDS: Cumulus[] = [
  // Front section (above flower garden / river)
  { x:-160, y: 140, z:  -40, w: 110, h: 38, seed:  1.3, density: 0.75, scale: 3.5 },
  { x:  80, y: 165, z:  -10, w:  95, h: 32, seed:  2.7, density: 0.70, scale: 3.8 },
  { x: 220, y: 130, z:  -80, w: 130, h: 42, seed:  4.1, density: 0.80, scale: 3.2 },
  { x: -40, y: 175, z:  -60, w: 150, h: 45, seed:  8.3, density: 0.78, scale: 3.0 },

  // Mid section (above forest)
  { x:-100, y: 195, z: -120, w:  85, h: 28, seed:  5.5, density: 0.65, scale: 4.0 },
  { x: 160, y: 210, z: -150, w: 120, h: 38, seed:  6.9, density: 0.72, scale: 3.4 },
  { x: 300, y: 180, z:  -90, w:  90, h: 30, seed:  9.7, density: 0.65, scale: 3.8 },
  { x:-260, y: 220, z: -160, w: 100, h: 32, seed: 11.1, density: 0.68, scale: 3.6 },
  { x:  20, y: 230, z: -180, w: 140, h: 42, seed: 12.5, density: 0.74, scale: 3.3 },
  { x: 200, y: 250, z: -210, w: 105, h: 34, seed: 13.9, density: 0.66, scale: 3.7 },

  // Far section (above valley / moon)
  { x:-180, y: 205, z: -260, w: 130, h: 40, seed: 15.3, density: 0.76, scale: 3.4 },
  { x: 110, y: 195, z: -300, w:  95, h: 32, seed: 16.7, density: 0.68, scale: 3.9 },
  { x:-330, y: 230, z: -340, w: 115, h: 36, seed: 18.1, density: 0.70, scale: 3.5 },
  { x: 260, y: 215, z: -380, w: 140, h: 44, seed: 19.5, density: 0.78, scale: 3.1 },
  { x:   0, y: 260, z: -340, w: 120, h: 38, seed: 20.9, density: 0.72, scale: 3.4 },
  { x: -90, y: 175, z: -420, w: 100, h: 32, seed: 22.3, density: 0.65, scale: 3.8 },
  { x: 180, y: 250, z: -460, w: 150, h: 46, seed: 23.7, density: 0.80, scale: 3.0 },
  { x:-220, y: 195, z: -480, w: 110, h: 34, seed: 25.1, density: 0.68, scale: 3.6 },
];

export default function DaySky() {
  const cloudMats = useMemo(
    () =>
      CLOUDS.map((c) =>
        buildCumulusMaterial({ seed: c.seed, density: c.density, scale: c.scale }),
      ),
    [],
  );
  const tRef = useRef(0);

  useFrame((_, dt) => {
    tRef.current += dt;
    for (let i = 0; i < cloudMats.length; i++) {
      cloudMats[i].uniforms.uTime.value = tRef.current;
    }
  });

  return (
    <>
      {/* Cumulus clouds */}
      {CLOUDS.map((c, i) => (
        <mesh
          key={i}
          position={[c.x, c.y, c.z]}
          material={cloudMats[i]}
          renderOrder={1}
        >
          <planeGeometry args={[c.w, c.h]} />
        </mesh>
      ))}
    </>
  );
}
