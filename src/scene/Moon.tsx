import { useMemo } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  DoubleSide,
  ShaderMaterial,
} from 'three';
import { setSunMesh } from './sunRef';

// Act IV — the moon dominates the final composition. The sphere itself
// doubles as the GodRays "sun" mesh (registered via setSunMesh) so we
// don't render a separate emitter and end up with two moons in frame.

const MOON_POS: [number, number, number] = [0, 88, -490];
const MOON_RADIUS = 26;

// Procedural moon-surface shader: cool-white base with low-frequency mare
// patches and a faint terminator dimming on the edge.
function buildMoonMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec3 vLocalPos;
      varying vec3 vNormal;
      void main() {
        vLocalPos = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vLocalPos;
      varying vec3 vNormal;

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      }
      float vnoise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash(i);
        float n100 = hash(i + vec3(1,0,0));
        float n010 = hash(i + vec3(0,1,0));
        float n110 = hash(i + vec3(1,1,0));
        float n001 = hash(i + vec3(0,0,1));
        float n101 = hash(i + vec3(1,0,1));
        float n011 = hash(i + vec3(0,1,1));
        float n111 = hash(i + vec3(1,1,1));
        return mix(
          mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
          mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y),
          f.z
        );
      }
      float fbm(vec3 p) {
        float v = 0.0, amp = 0.5;
        for (int i = 0; i < 5; i++) {
          v += amp * vnoise(p);
          p *= 2.07; amp *= 0.5;
        }
        return v;
      }
      void main() {
        vec3 base = vec3(0.92, 0.94, 1.00);     // cool white
        vec3 mare = vec3(0.55, 0.62, 0.78);     // bluish-grey lowlands
        float n = fbm(vLocalPos * 0.18);
        float patches = smoothstep(0.45, 0.62, n);
        vec3 col = mix(base, mare, patches * 0.55);
        // Crater speckle
        float speck = fbm(vLocalPos * 0.85 + 17.0);
        col *= mix(0.92, 1.06, speck);
        // Faint terminator dim on the edge so the disc reads as a sphere
        // even with MeshBasic lighting model.
        float edge = pow(1.0 - clamp(vNormal.z, 0.0, 1.0), 2.5);
        col *= mix(1.0, 0.72, edge * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    toneMapped: false,
  });
}

// Soft radial-gradient halo. Additive blend so it stacks cleanly into the
// bloom pass and reads as a glow rather than a disc.
function buildHaloMaterial(): ShaderMaterial {
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
        float d = length(vUv - 0.5) * 2.0;
        // Tight inner core fades to soft outer halo
        float core = smoothstep(0.55, 0.18, d);
        float outer = smoothstep(1.0, 0.30, d);
        float a = max(core * 0.85, outer * 0.35);
        vec3 col = mix(vec3(0.55, 0.80, 1.05), vec3(0.95, 0.98, 1.05), core);
        gl_FragColor = vec4(col * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  });
}

// Wispy procedural cloud — drifting fbm with soft alpha cutout.
function buildCloudMaterial(seed: number, driftSpeed: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed },
      uDrift: { value: driftSpeed },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSeed;
      uniform float uDrift;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, amp = 0.5;
        for (int i = 0; i < 5; i++) {
          v += amp * vnoise(p);
          p *= 2.05; amp *= 0.5;
        }
        return v;
      }
      void main() {
        // Long, thin wisps: stretch UV horizontally before fbm
        vec2 p = vec2(vUv.x * 1.6 + uTime * uDrift, vUv.y * 4.0 + uSeed);
        float n = fbm(p);
        // Soft top/bottom feather and horizontal feather so quad edges hide
        float feather = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x)
                      * smoothstep(0.0, 0.30, vUv.y) * smoothstep(1.0, 0.70, vUv.y);
        float a = smoothstep(0.48, 0.78, n) * feather * 0.55;
        vec3 col = vec3(0.78, 0.82, 0.92);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

// 4 cloud quads parameterized to drift across the moon plane at varied
// depths. Some pass in front, some behind (z-offset relative to moon).
const CLOUDS: Array<{
  pos: [number, number, number];
  size: [number, number];
  seed: number;
  drift: number;
}> = [
  { pos: [-22, 88, -470], size: [110, 22], seed: 1.3, drift: 0.012 },
  { pos: [ 30, 78, -465], size: [130, 20], seed: 4.9, drift: 0.009 },
  { pos: [-14, 96, -500], size: [150, 26], seed: 7.2, drift: 0.014 },
  { pos: [ 38, 100,-510], size: [100, 18], seed: 2.1, drift: 0.008 },
];

export default function Moon() {
  const moonMat = useMemo(() => buildMoonMaterial(), []);
  const haloMat = useMemo(() => buildHaloMaterial(), []);
  const cloudMats = useMemo(
    () => CLOUDS.map((c) => buildCloudMaterial(c.seed, c.drift)),
    []
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (const m of cloudMats) {
      m.uniforms.uTime.value = t;
    }
  });

  return (
    <>
      <mesh
        ref={setSunMesh}
        position={MOON_POS}
        material={moonMat}
      >
        <sphereGeometry args={[MOON_RADIUS, 64, 64]} />
      </mesh>
      {/* Halo billboard — slightly in front of the moon so it always faces
          camera and never disappears behind the sphere edge. */}
      <Billboard position={[MOON_POS[0], MOON_POS[1], MOON_POS[2] + 0.5]}>
        <mesh material={haloMat}>
          <planeGeometry args={[MOON_RADIUS * 4.5, MOON_RADIUS * 4.5]} />
        </mesh>
      </Billboard>
      {/* Cloud quads — billboarded so they always face the viewer */}
      {CLOUDS.map((c, i) => (
        <Billboard key={i} position={c.pos}>
          <mesh material={cloudMats[i]}>
            <planeGeometry args={c.size} />
          </mesh>
        </Billboard>
      ))}
    </>
  );
}
