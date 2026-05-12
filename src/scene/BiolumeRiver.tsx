import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  ShaderMaterial,
  Vector3,
} from 'three';
import { useAppStore } from '../store/appStore';

const RIVER_VISIBLE_FROM = 0.30;
const RIVER_VISIBLE_TO = 0.82;
import {
  riverCurve,
  riverLightPositions,
  RIVER_LIGHT_COLOR,
  RIVER_LIGHT_RANGE,
} from './riverLights';

// Silver/bioluminescent river. Crosses the camera path between the flower
// field (Act I) and the dark forest (Act II) at z ≈ -25 so the camera flies
// directly over its widest section at scroll ≈ 0.68 — the "bridge moment".

const RIVER_Z = -25;
const RIVER_WIDTH = 7.0;
const SEGMENTS_LEN = 220;
const SEGMENTS_W = 1;

function buildRiverGeometry(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const tangent = new Vector3();
  const up = new Vector3(0, 1, 0);
  const side = new Vector3();
  const point = new Vector3();

  for (let i = 0; i <= SEGMENTS_LEN; i++) {
    const t = i / SEGMENTS_LEN;
    riverCurve.getPoint(t, point);
    riverCurve.getTangent(t, tangent).normalize();
    side.crossVectors(tangent, up).normalize();
    // Width swells around t≈0.5 so the bridge moment crosses a wider basin.
    const widthSwell = 1.0 + 0.35 * Math.exp(-Math.pow((t - 0.5) / 0.18, 2.0));
    const w =
      RIVER_WIDTH * (0.85 + 0.25 * Math.sin(t * Math.PI * 3.7)) * widthSwell;
    for (let j = 0; j <= SEGMENTS_W; j++) {
      const u = j / SEGMENTS_W;
      const off = (u - 0.5) * 2 * (w * 0.5);
      const px = point.x + side.x * off;
      const py = 0.04;
      const pz = point.z + side.z * off;
      positions.push(px, py, pz);
      uvs.push(u, t);
    }
  }

  const cols = SEGMENTS_W + 1;
  for (let i = 0; i < SEGMENTS_LEN; i++) {
    for (let j = 0; j < SEGMENTS_W; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const g = new BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function buildRiverMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec3 p = position;
        float ripple = sin(uv.y * 90.0 + uTime * 1.8) * 0.008
                     + sin(uv.x * 40.0 - uTime * 1.2) * 0.005;
        p.y += ripple;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vViewDir;

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
        float v = 0.0; float amp = 0.5;
        for (int i = 0; i < 5; i++) {
          v += amp * vnoise(p);
          p *= 2.03; amp *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 flow = vec2(vUv.x * 3.0, vUv.y * 22.0 - uTime * 0.45);
        float n1 = fbm(flow);
        float n2 = fbm(flow * 2.4 + vec2(uTime * 0.22, -uTime * 0.15));
        float caustic = pow(0.5 + 0.5 * sin((n1 + n2) * 9.0 - uTime * 1.1), 4.0);

        vec3 deep = vec3(0.015, 0.075, 0.115);
        vec3 mid  = vec3(0.10, 0.55, 0.78);
        vec3 glow = vec3(0.70, 1.20, 1.35);

        float bodyMix = smoothstep(0.35, 0.85, n1 * 0.6 + n2 * 0.4);
        vec3 col = mix(deep, mid, bodyMix);
        col += glow * caustic * 0.85;

        float bankFade = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 3.0);
        col *= mix(0.45, 1.0, bankFade);

        // View-dependent fresnel rim: water surface normal is essentially +Y,
        // so a grazing view (low |viewDir.y|) lights the surface brightly,
        // while looking straight down dims it. Sells the water reading.
        float fres = pow(1.0 - clamp(vViewDir.y, 0.0, 1.0), 3.0);
        vec3 fresColor = vec3(0.55, 0.95, 1.15);
        col += fresColor * fres * 0.55 * bankFade;

        float sheen = 0.5 + 0.5 * sin(vUv.y * 14.0 - uTime * 0.6);
        col += vec3(0.05, 0.15, 0.20) * sheen * bankFade * 0.4;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
  });
}

export default function BiolumeRiver() {
  const groupRef = useRef<Group>(null);
  const geometry = useMemo(() => buildRiverGeometry(), []);
  const material = useMemo(() => buildRiverMaterial(), []);
  const matRef = useRef(material);

  useFrame((state) => {
    const s = useAppStore.getState().scrollProgress;
    const visible = s >= RIVER_VISIBLE_FROM && s <= RIVER_VISIBLE_TO;
    if (groupRef.current) groupRef.current.visible = visible;
    if (!visible) return;
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  const lightColor = useMemo(
    () =>
      `rgb(${Math.round(RIVER_LIGHT_COLOR[0] * 255)}, ${Math.round(
        RIVER_LIGHT_COLOR[1] * 255
      )}, ${Math.round(RIVER_LIGHT_COLOR[2] * 255)})`,
    []
  );

  return (
    <group ref={groupRef}>
      {/* Darker mud/wet-earth basin under the river */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, RIVER_Z]}>
        <planeGeometry args={[200, 18]} />
        <meshBasicMaterial color="#040a0c" toneMapped={false} />
      </mesh>
      <mesh geometry={geometry} material={material} frustumCulled={false} />
      {/* Riverbank point lights — cyan, low, lighting the forest's near
          edge. Distance=range so it falls off cleanly without blowing out. */}
      {riverLightPositions.map((p, i) => (
        <pointLight
          key={i}
          position={[p.x, p.y, p.z]}
          color={lightColor}
          intensity={2.2}
          distance={RIVER_LIGHT_RANGE}
          decay={1.4}
        />
      ))}
    </group>
  );
}
