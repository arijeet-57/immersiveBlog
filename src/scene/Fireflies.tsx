import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
} from 'three';

const COUNT = 170;

export default function Fireflies() {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT * 3);
    // Hover band: flower heads sit around y≈0.7 (stem 0.6 + head ~0.15).
    // Keep fireflies in a shallow layer just above them so they read as
    // hovering over the carpet, not floating freely in the sky.
    const FLY_Y_MIN = 0.85;
    const FLY_Y_MAX = 1.8;
    const FLY_SPREAD = 50; // slightly wider than the 40-unit flower field
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * FLY_SPREAD;
      positions[i * 3 + 1] = FLY_Y_MIN + Math.random() * (FLY_Y_MAX - FLY_Y_MIN);
      positions[i * 3 + 2] = (Math.random() - 0.5) * FLY_SPREAD;
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
          uSize: { value: 4.5 },
        },
        vertexShader: /* glsl */ `
          attribute vec3 aSeed;
          uniform float uTime;
          uniform float uSize;
          varying float vAlpha;

          void main() {
            vec3 p = position;
            p.x += sin(uTime * 0.5 + aSeed.x * 6.2831) * 0.45;
            p.y += sin(uTime * 0.4 + aSeed.y * 6.2831) * 0.18;
            p.z += cos(uTime * 0.6 + aSeed.z * 6.2831) * 0.45;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = uSize * (180.0 / -mv.z);
            vAlpha = 0.45 + 0.55 * sin(uTime * 2.0 + aSeed.x * 6.2831);
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vAlpha;
          void main() {
            vec2 d = gl_PointCoord - 0.5;
            float dist = length(d);
            if (dist > 0.5) discard;
            float intensity = smoothstep(0.5, 0.0, dist);
            vec3 gold = vec3(0.85, 0.7, 0.35);
            gl_FragColor = vec4(gold * intensity * vAlpha, intensity * vAlpha);
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
