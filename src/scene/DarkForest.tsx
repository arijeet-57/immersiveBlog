import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { useAppStore } from '../store/appStore';
import {
  riverLightUniformArray,
  RIVER_LIGHT_COUNT,
  RIVER_LIGHT_RANGE,
  RIVER_LIGHT_COLOR,
} from './riverLights';

// Tall realistic-style conifers (pines). Each tree is a single merged mesh:
// a tapered bark trunk plus a stack of progressively smaller needle cones.
// The geometry is region-tagged via uv.x so a single shader can paint bark
// vs needles for both surfaces in one draw call per InstancedMesh.

const TREE_COUNT = 180;
const GRASS_COUNT = 16000;
const BUSH_COUNT = 650;
const FERN_COUNT = 400;
const MIST_COUNT = 80;

// World range the forest covers. Starts just behind the river (z = -25),
// ends where the moonlit valley begins (~z = -195).
const FOREST_Z_NEAR = -32;
const FOREST_Z_FAR = -195;
const FOREST_HALF_W = 70;

const TRUNK_HEIGHT = 44.0;
const TRUNK_BASE_R = 0.62;
const TRUNK_TIP_R = 0.12;
const TRUNK_RINGS = 22;
const TRUNK_SIDES = 14;

// Region tags
const R_BARK = 0.1;
const R_NEEDLE = 0.7;

// Cones of needles concentrated at the TOP of the trunk only — long bare
// trunks below, small conifer crown above. Stack runs from y ≈ 33 → 44.
type ConeSpec = { y: number; r: number; h: number };
const CONES: ConeSpec[] = [
  { y: 33.5, r: 1.85, h: 1.7 },
  { y: 35.1, r: 1.55, h: 1.55 },
  { y: 36.5, r: 1.30, h: 1.40 },
  { y: 37.8, r: 1.05, h: 1.25 },
  { y: 39.0, r: 0.85, h: 1.10 },
  { y: 40.1, r: 0.65, h: 0.95 },
  { y: 41.1, r: 0.48, h: 0.80 },
  { y: 42.0, r: 0.32, h: 0.65 },
  { y: 42.8, r: 0.20, h: 0.55 },
];

function appendTrunk(positions: number[], uvs: number[], localUs: number[], indices: number[]) {
  const baseIdx = positions.length / 3;
  for (let ring = 0; ring <= TRUNK_RINGS; ring++) {
    const v = ring / TRUNK_RINGS;
    const y = v * TRUNK_HEIGHT;
    // Root flare: bottom 12% of trunk fattens out slightly.
    const flare = v < 0.12 ? Math.pow(1.0 - v / 0.12, 1.5) * 0.35 : 0;
    const r = TRUNK_BASE_R * (1 - v) + TRUNK_TIP_R * v + flare;
    // very subtle lean / bend so trunks aren't ramrod-straight
    const bx = Math.sin(v * Math.PI * 0.6) * 0.05;
    const bz = Math.cos(v * Math.PI * 0.4 + 1.0) * 0.04;
    for (let i = 0; i < TRUNK_SIDES; i++) {
      const a = (i / TRUNK_SIDES) * Math.PI * 2;
      // Per-vertex radial wobble so the trunk silhouette is irregular.
      const wob = (Math.sin(a * 5.0 + v * 9.0) + Math.cos(a * 3.0 + v * 17.0)) * 0.018;
      const rr = r + wob;
      positions.push(bx + Math.cos(a) * rr, y, bz + Math.sin(a) * rr);
      uvs.push(R_BARK, v);
      localUs.push(i / TRUNK_SIDES);
    }
  }
  for (let ring = 0; ring < TRUNK_RINGS; ring++) {
    const base = baseIdx + ring * TRUNK_SIDES;
    const next = baseIdx + (ring + 1) * TRUNK_SIDES;
    for (let i = 0; i < TRUNK_SIDES; i++) {
      const b1 = base + i;
      const b2 = base + ((i + 1) % TRUNK_SIDES);
      const t1 = next + i;
      const t2 = next + ((i + 1) % TRUNK_SIDES);
      indices.push(b1, b2, t2, b1, t2, t1);
    }
  }
}

function appendCone(
  positions: number[],
  uvs: number[],
  localUs: number[],
  indices: number[],
  cy: number,
  radius: number,
  height: number,
  jaggedness: number
) {
  // Closed cone built as 3 rings (base, mid-droop, apex) and a fan of
  // jagged radial spikes so the silhouette is needled rather than smooth.
  const SIDES = 18;
  const baseIdx = positions.length / 3;
  // Base ring (slightly drooping outer rim)
  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * Math.PI * 2;
    const seed = (Math.sin(i * 12.9898 + cy * 7.13) * 43758.5453) % 1;
    const radJ = radius * (1.0 + (seed - 0.5) * jaggedness * 0.5);
    positions.push(Math.cos(a) * radJ, cy - 0.12, Math.sin(a) * radJ);
    uvs.push(R_NEEDLE, 0.0);
    localUs.push(0);
  }
  // Mid ring (closer to apex, narrower)
  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * Math.PI * 2;
    const r = radius * 0.55;
    positions.push(Math.cos(a) * r, cy + height * 0.45, Math.sin(a) * r);
    uvs.push(R_NEEDLE, 0.6);
    localUs.push(0);
  }
  // Apex
  const apex = positions.length / 3;
  positions.push(0, cy + height, 0);
  uvs.push(R_NEEDLE, 1.0);
  localUs.push(0);

  // Faces: base->mid quads, mid->apex triangles
  for (let i = 0; i < SIDES; i++) {
    const b1 = baseIdx + i;
    const b2 = baseIdx + ((i + 1) % SIDES);
    const m1 = baseIdx + SIDES + i;
    const m2 = baseIdx + SIDES + ((i + 1) % SIDES);
    indices.push(b1, b2, m2, b1, m2, m1);
  }
  for (let i = 0; i < SIDES; i++) {
    const m1 = baseIdx + SIDES + i;
    const m2 = baseIdx + SIDES + ((i + 1) % SIDES);
    indices.push(m1, m2, apex);
  }

  // Jagged needle spikes — small thin tris radiating outward at the base
  // rim to break up the cone silhouette.
  const SPIKES = 22;
  for (let s = 0; s < SPIKES; s++) {
    const a = (s / SPIKES) * Math.PI * 2 + 0.1;
    const seed = ((Math.sin(s * 91.3 + cy * 0.7) * 43758.5453) % 1 + 1) % 1;
    const len = radius * (0.25 + seed * 0.55);
    const yJit = -0.05 - seed * 0.25;
    const tipX = Math.cos(a) * (radius + len);
    const tipZ = Math.sin(a) * (radius + len);
    const bx1 = Math.cos(a + 0.06) * radius;
    const bz1 = Math.sin(a + 0.06) * radius;
    const bx2 = Math.cos(a - 0.06) * radius;
    const bz2 = Math.sin(a - 0.06) * radius;
    const start = positions.length / 3;
    positions.push(bx1, cy - 0.1, bz1);
    positions.push(bx2, cy - 0.1, bz2);
    positions.push(tipX, cy + yJit, tipZ);
    for (let k = 0; k < 3; k++) {
      uvs.push(R_NEEDLE, 0.0);
      localUs.push(0);
    }
    indices.push(start, start + 1, start + 2);
  }
}

function buildPineGeometry(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const localUs: number[] = [];
  const indices: number[] = [];

  appendTrunk(positions, uvs, localUs, indices);
  for (const c of CONES) {
    appendCone(positions, uvs, localUs, indices, c.y, c.r, c.h, 0.4);
  }

  const g = new BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setAttribute('aLocalU', new Float32BufferAttribute(localUs, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function buildPineMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRiverLights: { value: riverLightUniformArray },
      uRiverLightColor: { value: new Vector3(...RIVER_LIGHT_COLOR) },
      uRiverLightRange: { value: RIVER_LIGHT_RANGE },
    },
    defines: {
      RIVER_LIGHT_COUNT: RIVER_LIGHT_COUNT,
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute float aLocalU;
      uniform float uTime;
      varying float vRegion;
      varying float vY;
      varying float vSeed;
      varying float vLocalU;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vRegion = uv.x;
        vY = uv.y;
        vSeed = aSeed;
        vLocalU = aLocalU;
        vNormal = normalize(normalMatrix * normal);
        vWorldNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vec3 p = position;
        // Wind sway: only upper crown moves, long trunk stays planted.
        float swayMask = smoothstep(28.0, 42.0, position.y);
        float swayAmt = sin(uTime * 0.35 + aSeed * 6.28) * 0.18 * swayMask;
        p.x += swayAmt;
        p.z += sin(uTime * 0.28 + aSeed * 4.13) * 0.08 * swayMask;
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vRegion;
      varying float vY;
      varying float vSeed;
      varying float vLocalU;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      uniform vec3 uRiverLights[RIVER_LIGHT_COUNT];
      uniform vec3 uRiverLightColor;
      uniform float uRiverLightRange;

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
          p *= 2.07; amp *= 0.5;
        }
        return v;
      }

      vec3 riverLightContribution(vec3 worldPos, vec3 worldNormal) {
        vec3 acc = vec3(0.0);
        for (int i = 0; i < RIVER_LIGHT_COUNT; i++) {
          vec3 toLight = uRiverLights[i] - worldPos;
          float dist = length(toLight);
          if (dist > uRiverLightRange) continue;
          vec3 dir = toLight / max(dist, 0.0001);
          float facing = clamp(dot(worldNormal, dir), 0.0, 1.0);
          // Smooth inverse falloff, clipped at range
          float atten = pow(1.0 - dist / uRiverLightRange, 2.2);
          acc += uRiverLightColor * facing * atten;
        }
        return acc;
      }

      void main() {
        vec3 col;
        if (vRegion < 0.4) {
          // Bark: layered fbm noise gives plate-like patches; tight vertical
          // cosine creates fissures running up the trunk; ring noise breaks
          // horizontal banding. Moss patches grow on the lower 25% of trunk.
          vec3 barkDeep  = vec3(0.038, 0.022, 0.014);
          vec3 barkDark  = vec3(0.075, 0.048, 0.028);
          vec3 barkLight = vec3(0.160, 0.110, 0.068);
          vec3 mossCol   = vec3(0.045, 0.110, 0.050);

          // Bark coordinates: U wraps around trunk, V runs up.
          vec2 barkUV = vec2(vLocalU * 12.0, vY * 26.0);
          float plates = fbm(barkUV * 0.65);
          float grain  = fbm(barkUV * 2.6 + vec2(7.0, 3.0));
          float fissure = pow(0.5 + 0.5 * cos(vLocalU * 96.0 + plates * 4.0), 5.0);

          col = mix(barkDeep, barkDark, plates);
          col = mix(col, barkLight, smoothstep(0.45, 0.85, grain) * 0.65);
          col *= mix(0.45, 1.0, 1.0 - fissure * 0.85);

          // Subtle horizontal ring noise (growth rings/scars)
          float ring = hash(vec2(floor(vY * 48.0), floor(vLocalU * 6.0 + plates * 3.0)));
          col *= mix(0.88, 1.06, ring);

          // Moss at the base, biased to side facing surfaces; uses world-space
          // noise so patches read as 3D-attached rather than UV-stretched.
          float baseMask = 1.0 - smoothstep(0.04, 0.28, vY);
          float mossNoise = fbm(vWorldPos.xz * 1.4 + vY * 6.0);
          float mossMask = smoothstep(0.55, 0.78, mossNoise) * baseMask;
          col = mix(col, mossCol * (0.7 + 0.7 * mossNoise), mossMask * 0.85);

          // Trunks are unlit by the moon (canopy blocks it) -- keep them
          // deep in shadow with only ambient haze contribution.
          col *= 0.55;
        } else {
          // Needles: layered fbm in world-space produces visible needle
          // clumps; brighter at clump tips, darker in shadowed pockets.
          vec3 needleDeep = vec3(0.010, 0.038, 0.022);
          vec3 needleDark = vec3(0.022, 0.068, 0.036);
          vec3 needleMid  = vec3(0.048, 0.128, 0.066);
          vec3 needleTip  = vec3(0.110, 0.210, 0.130);

          float clump = fbm(vWorldPos.xz * 3.2 + vec2(vWorldPos.y * 1.5, vSeed * 11.0));
          float fine  = fbm(vWorldPos.xz * 12.0 + vWorldPos.y * 4.0);
          col = mix(needleDeep, needleDark, smoothstep(0.30, 0.65, clump));
          col = mix(col, needleMid, smoothstep(0.55, 0.85, clump) * 0.9);
          col = mix(col, needleTip, smoothstep(0.78, 1.0, clump) * smoothstep(0.4, 1.0, fine));

          // Self-shadowing: deeper in the cone (lower y mid) is darker.
          float depthInCone = 1.0 - smoothstep(0.0, 0.6, vY);
          col *= mix(0.65, 1.05, 1.0 - depthInCone * 0.7);

          // Only the very top of the canopy catches moonlight; everything
          // below is heavy shadow. No side rim — moonlight should not
          // appear to penetrate through the trunks.
          float up = clamp(vNormal.y, 0.0, 1.0);
          float topMask = smoothstep(0.7, 1.0, vY);
          col = mix(col, needleTip * 0.65, up * topMask * 0.55);
          col *= 0.55;

          // Depth fade so receding crowns dissolve into mist.
          float depth = smoothstep(-30.0, -180.0, vWorldPos.z);
          col *= mix(1.0, 0.40, depth);
        }
        // Subtle cyan kick from the river — kept faint so trunks stay dark.
        col += riverLightContribution(vWorldPos, vWorldNormal) * 0.35;

        // Manual fog so distant trunks dissolve into the luminous blue
        // haze (custom ShaderMaterial doesn't receive scene fog).
        float fogDist = length(cameraPosition - vWorldPos);
        float fogFactor = clamp((fogDist - 30.0) / (320.0 - 30.0), 0.0, 1.0);
        vec3 fogCol = vec3(0.290, 0.471, 0.690);
        col = mix(col, fogCol, fogFactor);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
  });
}

// --- Undergrowth: grass, bushes, saplings --------------------------------

function buildForestGrassGeometry(): BufferGeometry {
  const SEGS = 4;
  const HEIGHT = 0.38;
  const BASE_W = 0.026;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= SEGS; i++) {
    const v = i / SEGS;
    const w = BASE_W * (1 - Math.pow(v, 1.4));
    const curl = Math.sin(v * Math.PI * 0.6) * 0.10;
    const y = v * HEIGHT;
    positions.push(-w, y, curl); uvs.push(0, v);
    positions.push(+w, y, curl); uvs.push(1, v);
  }
  for (let i = 0; i < SEGS; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const g = new BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function buildForestGrassMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      varying float vV;
      varying vec3 vNormal;
      void main() {
        vV = uv.y;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        float tipMask = smoothstep(0.2, 1.0, uv.y);
        p.x += sin(uTime * 0.9 + aSeed * 6.28) * 0.018 * tipMask;
        p.z += cos(uTime * 0.7 + aSeed * 6.28) * 0.018 * tipMask;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vV;
      varying vec3 vNormal;
      void main() {
        vec3 dark = vec3(0.018, 0.055, 0.030);
        vec3 mid  = vec3(0.040, 0.110, 0.058);
        vec3 tip  = vec3(0.065, 0.140, 0.085);
        vec3 col = mix(dark, mid, smoothstep(0.0, 0.6, vV));
        col = mix(col, tip, smoothstep(0.7, 1.0, vV));
        float side = clamp(1.0 - abs(vNormal.y), 0.0, 1.0);
        col += vec3(0.012, 0.024, 0.045) * side * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
  });
}

// Bush: a cluster of small broadleaf "leaf cards" arranged in a squashed
// hemisphere. Each card is a tapered oval with a slight cup so the bush
// reads as layered foliage rather than a single dome.
function buildBushGeometry(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const localUs: number[] = [];
  const indices: number[] = [];

  // Deterministic pseudo-random so the shared geometry is consistent.
  let seedI = 0;
  const rand = () => {
    seedI++;
    return ((Math.sin(seedI * 12.9898 + seedI * 78.233) * 43758.5453) % 1 + 1) % 1;
  };

  const LEAVES = 36;
  const LEAF_SEGS = 3;
  for (let li = 0; li < LEAVES; li++) {
    // Cluster center inside a squashed hemisphere of radius ~0.30
    const phi = rand() * Math.PI * 0.55;
    const theta = rand() * Math.PI * 2;
    const r = 0.10 + rand() * 0.22;
    const cx = r * Math.sin(phi) * Math.cos(theta);
    const cy = 0.08 + r * Math.cos(phi) * 0.85;
    const cz = r * Math.sin(phi) * Math.sin(theta);

    const leafLen = 0.13 + rand() * 0.11;
    const leafW = 0.055 + rand() * 0.040;
    const yawL = rand() * Math.PI * 2;
    // Bias pitch upward so leaves angle skyward like real foliage.
    const pitchL = -0.10 + rand() * 0.85;
    const cosY = Math.cos(yawL), sinY = Math.sin(yawL);
    const cosP = Math.cos(pitchL), sinP = Math.sin(pitchL);

    const baseIdx = positions.length / 3;
    for (let s = 0; s <= LEAF_SEGS; s++) {
      const v = s / LEAF_SEGS;
      // Oval profile: tapered both ends, widest in the middle.
      let w: number;
      if (v < 0.30) {
        const t = v / 0.30;
        w = leafW * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
      } else if (v < 0.72) {
        w = leafW;
      } else {
        const t = (v - 0.72) / 0.28;
        w = leafW * Math.sqrt(Math.max(0, 1 - t * t));
      }
      for (let side = 0; side < 2; side++) {
        const lx = side === 0 ? -w : w;
        const ly = v * leafLen;
        const lz = Math.sin(v * Math.PI) * 0.025; // slight cup
        const ry = cosP * ly + sinP * lz;
        const rz = -sinP * ly + cosP * lz;
        const fx = cosY * lx + sinY * rz;
        const fz = -sinY * lx + cosY * rz;
        positions.push(cx + fx, cy + ry, cz + fz);
        uvs.push(0, v);
        localUs.push(side);
      }
    }
    for (let s = 0; s < LEAF_SEGS; s++) {
      const a = baseIdx + s * 2;
      indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }

  const g = new BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setAttribute('aLocalU', new Float32BufferAttribute(localUs, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function buildBushMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aLocalU;
      uniform float uTime;
      varying float vV;
      varying float vLocalU;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vV = uv.y;
        vLocalU = aLocalU;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        // Subtle leaf-tip flutter; base stays anchored.
        float tipMask = smoothstep(0.20, 1.0, uv.y);
        float seed = floor(position.x * 23.0 + position.z * 17.0);
        p.x += sin(uTime * 0.75 + seed) * 0.012 * tipMask;
        p.z += cos(uTime * 0.62 + seed * 1.3) * 0.012 * tipMask;
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vV;
      varying float vLocalU;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        // Broadleaf palette: dark olive base, brighter mid, lighter tip.
        vec3 base = vec3(0.025, 0.072, 0.038);
        vec3 mid  = vec3(0.055, 0.130, 0.072);
        vec3 tip  = vec3(0.090, 0.175, 0.105);
        vec3 col = mix(base, mid, smoothstep(0.0, 0.55, vV));
        col = mix(col, tip, smoothstep(0.65, 1.0, vV));

        // Per-leaf hue variation so the bush isn't uniform.
        float n = hash(floor(vWorldPos.xz * 11.0));
        col *= mix(0.85, 1.12, n);

        // Central vein: a darker line down the leaf centerline.
        float lateral = abs(vLocalU - 0.5) * 2.0; // 0 at center, 1 at edge
        float vein = 1.0 - smoothstep(0.0, 0.08, lateral);
        col *= mix(1.0, 0.78, vein);

        // Edge slightly lighter (translucent feel) so the silhouette reads.
        col *= mix(1.0, 1.10, smoothstep(0.55, 1.0, lateral));

        // Up-facing leaves catch moonlight.
        float up = clamp(vNormal.y, 0.0, 1.0);
        col *= mix(0.85, 1.12, up);

        // Cool moonlit rim on side-facing surfaces.
        float side = clamp(1.0 - abs(vNormal.y), 0.0, 1.0);
        col += vec3(0.015, 0.028, 0.050) * side * 0.55;

        // Blue-hour fog
        float fogDist = length(cameraPosition - vWorldPos);
        float fogFactor = clamp((fogDist - 30.0) / (320.0 - 30.0), 0.0, 1.0);
        col = mix(col, vec3(0.290, 0.471, 0.690), fogFactor);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
  });
}

// --- Fern: a curved arching frond with paired leaflets along the rachis ---
function buildFernGeometry(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const FRONDS = 5;
  const FROND_SEGS = 8;
  for (let f = 0; f < FRONDS; f++) {
    const yaw = (f / FRONDS) * Math.PI * 2 + Math.random() * 0.4;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const baseIdx = positions.length / 3;
    const FROND_LEN = 0.55 + Math.random() * 0.20;
    const ARCH = 0.32;
    for (let i = 0; i <= FROND_SEGS; i++) {
      const v = i / FROND_SEGS;
      // arch outward and downward (gravity)
      const outward = Math.sin(v * Math.PI * 0.5) * FROND_LEN;
      const y = 0.05 + Math.sin(v * Math.PI * 0.8) * ARCH * 0.9 - v * 0.08;
      // half-width: widest in mid frond, narrow at base and tip
      const halfW = 0.10 * Math.sin(v * Math.PI) + 0.02;
      const x0 = -halfW;
      const x1 = +halfW;
      const cz = outward;
      const wx0 = cosY * x0 + sinY * cz;
      const wz0 = -sinY * x0 + cosY * cz;
      const wx1 = cosY * x1 + sinY * cz;
      const wz1 = -sinY * x1 + cosY * cz;
      positions.push(wx0, y, wz0); uvs.push(0, v);
      positions.push(wx1, y, wz1); uvs.push(1, v);
    }
    for (let i = 0; i < FROND_SEGS; i++) {
      const a = baseIdx + i * 2;
      indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
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

function buildFernMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      varying float vV;
      varying float vU;
      varying vec3 vNormal;
      void main() {
        vV = uv.y; vU = uv.x;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        float tipMask = smoothstep(0.3, 1.0, uv.y);
        p.x += sin(uTime * 0.6 + aSeed * 6.28) * 0.025 * tipMask;
        p.z += cos(uTime * 0.5 + aSeed * 6.28) * 0.025 * tipMask;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vV;
      varying float vU;
      varying vec3 vNormal;
      void main() {
        // Leaflet stripes across width to fake pinnate fronds.
        float pinnae = abs(sin(vV * 36.0));
        vec3 dark = vec3(0.022, 0.058, 0.028);
        vec3 mid  = vec3(0.048, 0.118, 0.060);
        vec3 tip  = vec3(0.078, 0.165, 0.095);
        vec3 col = mix(dark, mid, smoothstep(0.0, 0.5, vV));
        col = mix(col, tip, smoothstep(0.6, 1.0, vV) * 0.7);
        col *= mix(0.7, 1.05, pinnae);
        // Central rachis: a slim brown stripe down the center.
        float lat = abs(vU - 0.5) * 2.0;
        float rachis = 1.0 - smoothstep(0.0, 0.06, lat);
        col = mix(col, vec3(0.085, 0.055, 0.030), rachis * 0.7);
        // Moonlit edge
        float side = clamp(1.0 - abs(vNormal.y), 0.0, 1.0);
        col += vec3(0.014, 0.025, 0.045) * side * 0.4;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
  });
}

// Poisson-ish jittered grid distribution so trees don't clump but aren't
// gridded either. Trees inside the camera corridor are rejected; density
// soft-falls off near the corridor for a natural clearing.
function sampleTrees(count: number): Array<{ x: number; z: number; rot: number; scale: number }> {
  const out: Array<{ x: number; z: number; rot: number; scale: number }> = [];
  const aspectZ = FOREST_Z_NEAR - FOREST_Z_FAR; // positive
  const aspectX = FOREST_HALF_W * 2;
  const area = aspectX * aspectZ;
  const cell = Math.sqrt(area / (count * 1.6));
  const gridX = Math.ceil(aspectX / cell);
  const gridZ = Math.ceil(aspectZ / cell);
  for (let gz = 0; gz < gridZ; gz++) {
    for (let gx = 0; gx < gridX; gx++) {
      if (out.length >= count) return out;
      const cx = -FOREST_HALF_W + (gx + 0.5) * cell;
      const cz = FOREST_Z_NEAR - (gz + 0.5) * cell;
      const jx = (Math.random() - 0.5) * cell * 0.85;
      const jz = (Math.random() - 0.5) * cell * 0.85;
      const x = cx + jx;
      const z = cz + jz;
      const rot = Math.random() * Math.PI * 2;
      const scale = 0.85 + Math.random() * 0.55; // ±height jitter
      out.push({ x, z, rot, scale });
    }
  }
  return out;
}

// Forest mist: large soft billboarded fbm-alpha quads scattered low in
// the forest, drifting slowly. Catches the god ray volumetric color and
// creates the heavy haze that fills the gaps between trunks.
function buildMistMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      varying vec2 vUv;
      varying float vSeed;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vSeed = aSeed;
        // Sprite-like billboard: extract camera-aligned basis from view matrix
        // and rebuild the quad facing the camera.
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 worldOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        // Get instance scale from the diagonal of the model-instance matrix
        mat4 mi = modelMatrix * instanceMatrix;
        float sx = length(vec3(mi[0]));
        float sy = length(vec3(mi[1]));
        vec3 wp = worldOrigin + right * position.x * sx + up * position.y * sy;
        vWorldPos = wp;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying float vSeed;
      varying vec3 vWorldPos;
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
        // Drifting noise so the mist breathes.
        vec2 p = vUv * 2.5 + vec2(uTime * 0.03 + vSeed * 7.0, uTime * 0.02);
        float n = fbm(p);
        // Soft circular falloff so the quad reads as a wisp, not a rectangle.
        float d = length(vUv - 0.5) * 2.0;
        float circle = smoothstep(1.0, 0.25, d);
        float a = smoothstep(0.35, 0.85, n) * circle * 0.42;
        // Luminous blue-hour haze tint — matches the fog color so mist
        // wisps read as denser pockets of the same atmosphere.
        vec3 col = vec3(0.42, 0.58, 0.82);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

// Forest floor: needle litter + moss patches + leaf debris via fbm noise.
function buildFloorMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldPos;
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
          p *= 2.05; amp *= 0.5;
        }
        return v;
      }
      void main() {
        vec2 uv = vWorldPos.xz;
        // Three texture layers: dirt base, needle litter streaks, moss
        // patches. Each picks its color from fbm-driven masks.
        vec3 dirt    = vec3(0.030, 0.022, 0.014);
        vec3 humus   = vec3(0.055, 0.038, 0.020);
        vec3 needle  = vec3(0.045, 0.030, 0.012);
        vec3 moss    = vec3(0.030, 0.085, 0.040);
        vec3 leaf    = vec3(0.090, 0.060, 0.025);

        float coarse = fbm(uv * 0.18);
        float mid    = fbm(uv * 0.9 + 13.0);
        float fine   = fbm(uv * 5.5);

        vec3 col = mix(dirt, humus, smoothstep(0.35, 0.7, coarse));
        // Needle streaks (anisotropic — stretched along z to suggest fallen needles)
        float needleMask = fbm(vec2(uv.x * 6.0, uv.y * 1.4));
        col = mix(col, needle, smoothstep(0.55, 0.85, needleMask) * 0.7);
        // Moss patches (clumpy)
        float mossMask = smoothstep(0.62, 0.82, fbm(uv * 0.45 + 7.0));
        col = mix(col, moss, mossMask * 0.85);
        // Leaf debris (small, sparse)
        float leafMask = smoothstep(0.78, 0.88, fine);
        col = mix(col, leaf, leafMask * 0.5);

        // Dappled shading + heavy darkening for the moonless forest floor.
        col *= mix(0.4, 0.85, mid);
        // Blue-hour fog
        float fogDist = length(cameraPosition - vWorldPos);
        float fogFactor = clamp((fogDist - 30.0) / (320.0 - 30.0), 0.0, 1.0);
        col = mix(col, vec3(0.290, 0.471, 0.690), fogFactor);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    toneMapped: false,
  });
}

// Scroll range during which the forest is visible.
// Forest is on much earlier so distant trunks fade in through the fog
// (25→280) rather than popping into existence as the camera arrives.
const FOREST_VISIBLE_FROM = 0.18;
const FOREST_VISIBLE_TO = 0.96;

export default function DarkForest() {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<InstancedMesh>(null);
  const grassRef = useRef<InstancedMesh>(null);
  const bushRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => buildPineGeometry(), []);
  const material = useMemo(() => buildPineMaterial(), []);
  const grassGeom = useMemo(() => buildForestGrassGeometry(), []);
  const grassMat = useMemo(() => buildForestGrassMaterial(), []);
  const bushGeom = useMemo(() => buildBushGeometry(), []);
  const bushMat = useMemo(() => buildBushMaterial(), []);
  const fernGeom = useMemo(() => buildFernGeometry(), []);
  const fernMat = useMemo(() => buildFernMaterial(), []);
  const floorMat = useMemo(() => buildFloorMaterial(), []);
  const mistMat = useMemo(() => buildMistMaterial(), []);
  const fernRef = useRef<InstancedMesh>(null);
  const mistRef = useRef<InstancedMesh>(null);
  const mistGeom = useMemo(() => {
    const g = new BufferGeometry();
    // Non-indexed quad (two triangles, six vertices) to avoid index-buffer plumbing.
    const positions = new Float32Array([
      -0.5, -0.5, 0,   0.5, -0.5, 0,   0.5, 0.5, 0,
      -0.5, -0.5, 0,   0.5,  0.5, 0,  -0.5, 0.5, 0,
    ]);
    const uvs = new Float32Array([
      0, 0,  1, 0,  1, 1,
      0, 0,  1, 1,  0, 1,
    ]);
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    g.computeBoundingSphere();
    return g;
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new Matrix4();
    const pos = new Vector3();
    const q = new Quaternion();
    const e = new Euler();
    const scale = new Vector3();
    const samples = sampleTrees(TREE_COUNT);
    const realCount = samples.length;
    const seeds = new Float32Array(realCount);
    for (let i = 0; i < realCount; i++) {
      const s = samples[i];
      pos.set(s.x, 0, s.z);
      const tilt = (Math.random() - 0.5) * 0.04;
      e.set(tilt, s.rot, tilt * 0.5, 'YXZ');
      q.setFromEuler(e);
      scale.set(s.scale, s.scale * (0.95 + Math.random() * 0.2), s.scale);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
      seeds[i] = Math.random();
    }
    mesh.count = realCount;
    mesh.instanceMatrix.needsUpdate = true;
    geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
  }, [geometry]);

  // Undergrowth: grass and broadleaf bushes.
  useEffect(() => {
    const gmesh = grassRef.current;
    const bmesh = bushRef.current;
    if (!gmesh || !bmesh) return;
    const m = new Matrix4();
    const pos = new Vector3();
    const q = new Quaternion();
    const e = new Euler();
    const scale = new Vector3();

    const grassSeeds = new Float32Array(GRASS_COUNT);
    for (let i = 0; i < GRASS_COUNT; i++) {
      const x = (Math.random() - 0.5) * (FOREST_HALF_W * 2 + 30);
      const z = FOREST_Z_NEAR - Math.random() * (FOREST_Z_NEAR - FOREST_Z_FAR);
      pos.set(x, 0, z);
      const pitch = (Math.random() - 0.5) * 0.20;
      const yaw = Math.random() * Math.PI * 2;
      const roll = (Math.random() - 0.5) * 0.20;
      e.set(pitch, yaw, roll, 'YXZ');
      q.setFromEuler(e);
      const s = 0.7 + Math.random() * 0.6;
      scale.set(s, s * (0.85 + Math.random() * 0.35), s);
      m.compose(pos, q, scale);
      gmesh.setMatrixAt(i, m);
      grassSeeds[i] = Math.random();
    }
    gmesh.count = GRASS_COUNT;
    gmesh.instanceMatrix.needsUpdate = true;
    grassGeom.setAttribute('aSeed', new InstancedBufferAttribute(grassSeeds, 1));

    for (let i = 0; i < BUSH_COUNT; i++) {
      const x = (Math.random() - 0.5) * (FOREST_HALF_W * 2 + 20);
      const z = FOREST_Z_NEAR - Math.random() * (FOREST_Z_NEAR - FOREST_Z_FAR);
      pos.set(x, 0, z);
      const yaw = Math.random() * Math.PI * 2;
      e.set(0, yaw, 0, 'YXZ');
      q.setFromEuler(e);
      const s = 0.8 + Math.random() * 0.9;
      scale.set(s * (0.9 + Math.random() * 0.3), s * (0.7 + Math.random() * 0.5), s * (0.9 + Math.random() * 0.3));
      m.compose(pos, q, scale);
      bmesh.setMatrixAt(i, m);
    }
    bmesh.count = BUSH_COUNT;
    bmesh.instanceMatrix.needsUpdate = true;

    // Ferns scattered between bushes
    const fmesh = fernRef.current;
    if (fmesh) {
      const fernSeeds = new Float32Array(FERN_COUNT);
      for (let i = 0; i < FERN_COUNT; i++) {
        const x = (Math.random() - 0.5) * (FOREST_HALF_W * 2 + 20);
        const z = FOREST_Z_NEAR - Math.random() * (FOREST_Z_NEAR - FOREST_Z_FAR);
        pos.set(x, 0, z);
        const yaw = Math.random() * Math.PI * 2;
        e.set(0, yaw, 0, 'YXZ');
        q.setFromEuler(e);
        const s = 0.85 + Math.random() * 0.7;
        scale.set(s, s * (0.9 + Math.random() * 0.3), s);
        m.compose(pos, q, scale);
        fmesh.setMatrixAt(i, m);
        fernSeeds[i] = Math.random();
      }
      fmesh.count = FERN_COUNT;
      fmesh.instanceMatrix.needsUpdate = true;
      fernGeom.setAttribute('aSeed', new InstancedBufferAttribute(fernSeeds, 1));
    }

    // Mist patches: large soft billboards scattered low through the forest.
    const mmesh = mistRef.current;
    if (mmesh) {
      const mistSeeds = new Float32Array(MIST_COUNT);
      for (let i = 0; i < MIST_COUNT; i++) {
        const x = (Math.random() - 0.5) * (FOREST_HALF_W * 2 + 40);
        const z = FOREST_Z_NEAR - Math.random() * (FOREST_Z_NEAR - FOREST_Z_FAR);
        const y = 1.5 + Math.random() * 6.0;
        pos.set(x, y, z);
        e.set(0, 0, 0, 'YXZ');
        q.setFromEuler(e);
        const w = 14 + Math.random() * 22;
        const h = 6 + Math.random() * 10;
        scale.set(w, h, 1);
        m.compose(pos, q, scale);
        mmesh.setMatrixAt(i, m);
        mistSeeds[i] = Math.random() * 10;
      }
      mmesh.count = MIST_COUNT;
      mmesh.instanceMatrix.needsUpdate = true;
      mistGeom.setAttribute('aSeed', new InstancedBufferAttribute(mistSeeds, 1));
    }
  }, [grassGeom, bushGeom, fernGeom, mistGeom]);

  useFrame((state) => {
    const s = useAppStore.getState().scrollProgress;
    const visible = s >= FOREST_VISIBLE_FROM && s <= FOREST_VISIBLE_TO;
    if (groupRef.current) groupRef.current.visible = visible;
    if (!visible) return;
    const t = state.clock.elapsedTime;
    material.uniforms.uTime.value = t;
    grassMat.uniforms.uTime.value = t;
    bushMat.uniforms.uTime.value = t;
    fernMat.uniforms.uTime.value = t;
    floorMat.uniforms.uTime.value = t;
    mistMat.uniforms.uTime.value = t;
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Forest floor: needle litter / moss / leaf debris shader */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, (FOREST_Z_NEAR + FOREST_Z_FAR) / 2]}
        material={floorMat}
      >
        <planeGeometry args={[FOREST_HALF_W * 2 + 40, FOREST_Z_NEAR - FOREST_Z_FAR]} />
      </mesh>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, TREE_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={grassRef}
        args={[grassGeom, grassMat, GRASS_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={bushRef}
        args={[bushGeom, bushMat, BUSH_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={fernRef}
        args={[fernGeom, fernMat, FERN_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={mistRef}
        args={[mistGeom, mistMat, MIST_COUNT]}
        frustumCulled={false}
      />
    </group>
  );
}
