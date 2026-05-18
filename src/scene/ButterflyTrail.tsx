import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
} from 'three';
import { butterflyWorldPos, butterflyVisibility, TRAIL_INTENSITY } from './butterflyRef';

// Ring-buffer particle trail emitted from the butterfly's position.
// 60 particles, ~2 s lifetime, single draw call via THREE.Points.

const COUNT = 220;
const LIFETIME = 3.4; // seconds — longer trail persistence for soft halo
const INTENSITY = TRAIL_INTENSITY / 100; // normalised 0-1

export default function ButterflyTrail() {
  const headRef = useRef(0); // ring-buffer write head
  const birthRef = useRef(new Float32Array(COUNT).fill(-999));

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    const seeds     = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      seeds[i] = Math.random();
    }
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    g.setAttribute('aSeed',    new Float32BufferAttribute(seeds, 1));
    g.setAttribute('aBirth',   new Float32BufferAttribute(new Float32Array(COUNT).fill(-999), 1));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uLifetime: { value: LIFETIME },
          uIntensity: { value: INTENSITY },
        },
        vertexShader: /* glsl */ `
          attribute float aSeed;
          attribute float aBirth;
          uniform float uTime;
          uniform float uLifetime;
          uniform float uIntensity;
          varying float vAlpha;
          varying float vSeed;

          void main() {
            float age = uTime - aBirth;
            float t = clamp(age / uLifetime, 0.0, 1.0);

            vec3 p = position;
            // Gentle drift while fading
            p.x += sin(aSeed * 6.28 + uTime * 0.8) * 0.03 * t;
            p.y += t * 0.06; // float upward
            p.z += cos(aSeed * 6.28 + uTime * 0.6) * 0.03 * t;

            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;

            // Variable particle sizes — small specks + larger motes.
            // Pixel sizes (NOT distance-scaled) so dots stay crisp and bright.
            float isBig = step(0.78, aSeed);                  // ~22% big motes
            float sizeBase = mix(4.0, 9.0, aSeed);            // small sparkles
            float sizeBig  = mix(14.0, 24.0, fract(aSeed * 7.13));
            float size = mix(sizeBase, sizeBig, isBig);
            float sizeEnv = mix(1.0, 0.55, smoothstep(0.2, 1.0, t));
            // Mild depth attenuation only (clamped) so far particles don't vanish
            float depthAtten = clamp(60.0 / -mv.z, 0.3, 3.0);
            gl_PointSize = size * sizeEnv * uIntensity * depthAtten;

            // Fade: quick pop-in, slow lingering fade
            float fadeIn  = smoothstep(0.0, 0.06, t);
            float fadeOut = 1.0 - smoothstep(0.30, 1.0, t);
            vAlpha = fadeIn * fadeOut * step(0.0, age);
            vSeed = aSeed;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vAlpha;
          varying float vSeed;

          void main() {
            vec2 d = gl_PointCoord - 0.5;
            float dist = length(d);
            if (dist > 0.5) discard;

            // Dot profile: hot bright core with a soft halo.
            float core = smoothstep(0.30, 0.0, dist);
            float halo = exp(-dist * dist * 5.0);
            float intensity = core * 2.2 + halo * 0.7;

            // Blue + white palette
            vec3 white = vec3(1.00, 1.00, 1.00);
            vec3 blue  = vec3(0.40, 0.70, 1.00);
            vec3 col = mix(blue, white, step(0.5, fract(vSeed * 13.37)));

            // Strong emissive output — additive blending stacks across pixels.
            vec3 outCol = col * intensity * vAlpha * 6.0 * uIntensity;
            gl_FragColor = vec4(outCol, intensity * vAlpha * uIntensity);
          }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,        // always render on top — no occlusion from foliage / ground
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    material.uniforms.uTime.value = time;

    const posAttr   = geometry.attributes.position as Float32BufferAttribute;
    const birthAttr = geometry.attributes.aBirth   as Float32BufferAttribute;

    // Skip emission entirely while the butterfly is hidden — otherwise the
    // ring buffer fills with stale particles at the off-screen fly-in pose.
    if (butterflyVisibility.value < 0.05) return;

    // Emit 3–5 puffs per frame with a wider scatter — denser, fluffier halo
    const emitCount = 3 + Math.floor(Math.random() * 3);
    for (let e = 0; e < emitCount; e++) {
      const idx = headRef.current % COUNT;
      posAttr.setXYZ(
        idx,
        butterflyWorldPos.x + (Math.random() - 0.5) * 0.10,
        butterflyWorldPos.y + (Math.random() - 0.5) * 0.10,
        butterflyWorldPos.z + (Math.random() - 0.5) * 0.10,
      );
      birthRef.current[idx] = time;
      birthAttr.setX(idx, time);
      headRef.current++;
    }

    posAttr.needsUpdate = true;
    birthAttr.needsUpdate = true;
  });

  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={999}
    />
  );
}
