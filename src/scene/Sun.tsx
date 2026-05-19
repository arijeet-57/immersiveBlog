import { useMemo, useRef } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, ShaderMaterial } from 'three';

// Daytime sun: a bright white-yellow disc layered with a soft halo and a
// procedural ray fan that suggests god-light. Billboarded so it always
// faces the camera. Position is high & a bit behind so it stays in frame
// across most of the camera spline.
// Same position as the moon — see Moon.tsx MOON_POS.
const SUN_POS: [number, number, number] = [0, 88, -490];
const SUN_CORE_SIZE = 26;
const SUN_HALO_SIZE = 220;

// ── Core disc: sharp white-hot center, warm-yellow falloff ────────────────
function buildCoreMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vec2 d = vUv - 0.5;
        float r = length(d) * 2.0;
        if (r > 1.0) discard;

        // Pure white core that ramps fast to a warm-yellow edge.
        float hot   = smoothstep(0.28, 0.10, r);
        float warm  = smoothstep(1.00, 0.30, r);
        vec3 white  = vec3(1.00, 0.99, 0.95);
        vec3 yellow = vec3(1.00, 0.92, 0.62);

        vec3 col = mix(yellow * warm, white, hot);
        float alpha = max(hot, warm);
        gl_FragColor = vec4(col * 2.6, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

// ── Halo + god-ray fan ─────────────────────────────────────────────────────
// Wider billboard with: (a) a soft circular bloom halo, and (b) a radial
// "ray fan" — bright spokes emanating from center, attenuating outward.
function buildHaloMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
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

      // Hash + value noise for slow flicker of individual rays.
      float hash(float n) { return fract(sin(n) * 43758.5453); }

      void main() {
        vec2 d = vUv - 0.5;
        float r = length(d) * 2.0;
        if (r > 1.0) discard;
        float angle = atan(d.y, d.x);

        // ── Soft circular bloom halo around the disc ─────────────────────
        float halo = pow(max(0.0, 1.0 - r), 3.2) * 0.85;

        // ── God-ray fan ──────────────────────────────────────────────────
        // 14 evenly spaced rays. Per-ray noise jitters brightness so the
        // fan looks atmospheric, not procedurally clean.
        float spokes = 14.0;
        float a = angle * spokes * 0.5 / 3.14159265;  // normalized to spokes
        float spokeId = floor(a);
        float spokeFrac = fract(a);
        // Sharp ray cross-section: bright on-axis, fades quickly off-axis.
        float ray = pow(1.0 - abs(spokeFrac - 0.5) * 2.0, 18.0);
        // Per-ray flicker
        float flick = 0.55 + 0.45 * sin(uTime * 0.7 + spokeId * 17.3 + hash(spokeId) * 6.28);
        ray *= flick;
        // Distance attenuation — rays bright near disc, dissolve outward
        float rayAtten = pow(1.0 - r, 1.4);
        float rays = ray * rayAtten * 0.85;

        // ── Combine ──────────────────────────────────────────────────────
        vec3 warm  = vec3(1.00, 0.92, 0.68);
        vec3 gold  = vec3(1.00, 0.82, 0.45);
        vec3 col   = warm * halo + gold * rays;

        float alpha = clamp(halo + rays * 0.7, 0.0, 1.0);
        gl_FragColor = vec4(col * 1.4, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

export default function Sun() {
  const coreMat = useMemo(() => buildCoreMaterial(), []);
  const haloMat = useMemo(() => buildHaloMaterial(), []);
  const haloRef = useRef<ShaderMaterial>(haloMat);

  useFrame((state) => {
    haloRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <Billboard position={SUN_POS}>
      {/* Halo + god-ray fan (back layer, large) */}
      <mesh material={haloMat} renderOrder={1}>
        <planeGeometry args={[SUN_HALO_SIZE, SUN_HALO_SIZE]} />
      </mesh>
      {/* Bright disc (front layer) */}
      <mesh material={coreMat} renderOrder={2} position={[0, 0, 0.01]}>
        <planeGeometry args={[SUN_CORE_SIZE * 2, SUN_CORE_SIZE * 2]} />
      </mesh>
    </Billboard>
  );
}

export { SUN_POS };
