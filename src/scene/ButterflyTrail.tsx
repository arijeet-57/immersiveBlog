import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
} from 'three';
import { butterflyWorldPos, TRAIL_INTENSITY } from './butterflyRef';

// Ring-buffer particle trail emitted from the butterfly's position.
// 60 particles, ~2 s lifetime, single draw call via THREE.Points.

const COUNT = 150;
const LIFETIME = 2.0; // seconds
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

            // Size: starts much larger, shrinks to tiny dust
            float size = mix(6.0, 0.5, t) * uIntensity;
            gl_PointSize = size * (120.0 / -mv.z);

            // Fade: quick ramp in, slow fade out
            float fadeIn  = smoothstep(0.0, 0.05, t);
            float fadeOut = 1.0 - smoothstep(0.3, 1.0, t);
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
            float intensity = smoothstep(0.5, 0.0, dist);

            // 90% cyan-blue, 10% gold sparkle
            vec3 cyan = vec3(0.20, 0.60, 1.0);
            vec3 gold = vec3(0.85, 0.70, 0.35);
            vec3 col = mix(cyan, gold, step(0.90, vSeed));

            gl_FragColor = vec4(col * intensity * vAlpha * 1.8 * uIntensity, intensity * vAlpha * uIntensity);
          }
        `,
        transparent: true,
        depthWrite: false,
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

    // Emit 2–4 particles per frame at the butterfly's current position for a thicker trail
    const emitCount = 2 + Math.floor(Math.random() * 3);
    for (let e = 0; e < emitCount; e++) {
      const idx = headRef.current % COUNT;
      // Slight random offset from center
      posAttr.setXYZ(
        idx,
        butterflyWorldPos.x + (Math.random() - 0.5) * 0.04,
        butterflyWorldPos.y + (Math.random() - 0.5) * 0.04,
        butterflyWorldPos.z + (Math.random() - 0.5) * 0.04,
      );
      birthRef.current[idx] = time;
      birthAttr.setX(idx, time);
      headRef.current++;
    }

    posAttr.needsUpdate = true;
    birthAttr.needsUpdate = true;
  });

  return (
    <points geometry={geometry} material={material} frustumCulled={false} />
  );
}
