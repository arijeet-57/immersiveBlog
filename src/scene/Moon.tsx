import { useMemo } from 'react';
import { Billboard } from '@react-three/drei';
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
const MOON_RADIUS = 15;

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
        // Blue-hour moon: deep ice-blue. The disc reads clearly blue
        // rather than gray so it harmonizes with the dark-blue sky.
        vec3 base = vec3(0.155, 0.245, 0.520);
        vec3 mare = vec3(0.060, 0.115, 0.355);
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
        // Halo confined tight to the disc so it can't extend visually
        // past the moon and bleed around tree trunks in screen space.
        float core = smoothstep(0.50, 0.20, d);
        float outer = smoothstep(0.85, 0.40, d);
        float a = max(core * 0.286, outer * 0.102);
        vec3 col = mix(vec3(0.080, 0.165, 0.470), vec3(0.160, 0.245, 0.580), core);
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

export default function Moon() {
  const moonMat = useMemo(() => buildMoonMaterial(), []);
  const haloMat = useMemo(() => buildHaloMaterial(), []);

  return (
    <>
      <mesh
        ref={setSunMesh}
        position={MOON_POS}
        material={moonMat}
        renderOrder={-1}
      >
        <sphereGeometry args={[MOON_RADIUS, 64, 64]} />
      </mesh>
      {/* Halo billboard — slightly in front of the moon so it always faces
          camera and never disappears behind the sphere edge. */}
      <Billboard position={[MOON_POS[0], MOON_POS[1], MOON_POS[2] + 0.5]}>
        <mesh material={haloMat}>
          <planeGeometry args={[MOON_RADIUS * 1.6, MOON_RADIUS * 1.6]} />
        </mesh>
      </Billboard>
    </>
  );
}
