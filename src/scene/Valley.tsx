import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  Vector3,
  Group,
} from 'three';
import { useAppStore } from '../store/appStore';

// Act III½ — the Moonlit Valley.
//
// A wide rolling-hills basin that the camera glides over after exiting the
// dark forest and before the moonrise. Carpeted with the same cobalt
// hepatica flowers as Act I plus a denser firefly haze. Hills are a single
// displaced plane; flowers and fireflies sample the same height function so
// they sit on the terrain rather than floating.

const VALLEY_Z_NEAR = -195;
const VALLEY_Z_FAR = -440;
const VALLEY_HALF_W = 110;
const VALLEY_DEPTH = VALLEY_Z_NEAR - VALLEY_Z_FAR; // positive

// Counts tuned for steady 60fps. Instanced meshes are one draw call each but
// the GPU still runs the vertex shader per-instance × per-vertex, so total
// vertex throughput is the bottleneck, not draw-call count.
const FLOWER_COUNT = 50000;
const LAVENDER_COUNT = 15000;
const GRASS_COUNT = 14000;
const TWIG_COUNT = 900;
const FIREFLY_COUNT = 1200;

// Shared hill height function — must match the shader displacement below so
// scattered flowers/fireflies follow the terrain.
//
// Composition:
//   • A tall ridge that crests just after the forest exit (z ≈ -205). The
//     camera climbs onto this ridge and looks DOWN into the valley basin.
//   • A subtle basin dip beyond the ridge so the valley reads as a bowl.
//   • Rolling base hills carpet the entire footprint.
const RIDGE_Z = -230;
const RIDGE_SIGMA = 24;
const RIDGE_HEIGHT = 14;
const BASIN_Z = -310;
const BASIN_SIGMA = 80;
const BASIN_DEPTH = 1.6;

// Discrete knolls scattered through the basin — taller bumps that break the
// landscape so the valley reads as proper hilly country, not a smooth lawn.
const KNOLLS: Array<{ x: number; z: number; h: number; sx: number; sz: number }> = [
  { x: 38, z: -270, h: 5.5, sx: 24, sz: 20 },
  { x: -44, z: -300, h: 6.2, sx: 28, sz: 24 },
  { x: 16, z: -345, h: 4.8, sx: 22, sz: 26 },
  { x: -28, z: -385, h: 5.6, sx: 20, sz: 22 },
  { x: 58, z: -340, h: 4.0, sx: 18, sz: 18 },
  { x: -65, z: -255, h: 3.4, sx: 16, sz: 18 },
  { x: 72, z: -400, h: 4.6, sx: 22, sz: 20 },
];

function hillHeight(x: number, z: number): number {
  // Multi-octave rolling hills across the whole footprint.
  const rolling =
    Math.sin(x * 0.045) * 1.5 +
    Math.cos(z * 0.038 + 1.1) * 1.3 +
    Math.sin((x + z) * 0.082 + 0.4) * 0.5 +
    Math.sin(x * 0.13 + z * 0.07) * 0.9 +
    Math.cos(x * 0.21 - z * 0.17 + 2.1) * 0.55 +
    Math.sin(x * 0.31 + z * 0.27 + 4.7) * 0.25;

  const dz = (z - RIDGE_Z) / RIDGE_SIGMA;
  const ridgeFalloff = Math.exp(-dz * dz);
  const xTaper = Math.max(0, 1 - Math.abs(x) / 130);
  const ridgeWobble = Math.sin(x * 0.07 + 1.3) * 1.4 + Math.cos(x * 0.18) * 0.6;
  const ridge = (RIDGE_HEIGHT + ridgeWobble) * ridgeFalloff * xTaper;

  const db = (z - BASIN_Z) / BASIN_SIGMA;
  const basinMask = Math.exp(-db * db);
  const basin = -BASIN_DEPTH * basinMask;

  // Stronger uneven terrain concentrated in the basin.
  const basinHills =
    (Math.sin(x * 0.11 + 0.3) * 2.2 +
      Math.cos(z * 0.095 + 1.7) * 2.4 +
      Math.sin(x * 0.16 - z * 0.13 + 4.2) * 1.6 +
      Math.cos(x * 0.27 + z * 0.21) * 0.8) *
    basinMask;

  let knoll = 0;
  for (const k of KNOLLS) {
    const kx = (x - k.x) / k.sx;
    const kz = (z - k.z) / k.sz;
    knoll += k.h * Math.exp(-(kx * kx + kz * kz));
  }

  return rolling + ridge + basin + basinHills + knoll;
}

// --- Terrain ---------------------------------------------------------------

// Build the heightmap mesh directly in world space with displacement and
// normals baked once. Positions are absolute world XYZ — no rotation, no
// translation on the mesh — so the vertex shader is a near-trivial
// passthrough.
function bakeTerrainGeometry(): BufferGeometry {
  const W = 72; // x segments
  const H = 96; // z segments
  const xSpan = VALLEY_HALF_W * 2;
  const zSpan = VALLEY_DEPTH;
  const vw = W + 1;
  const vh = H + 1;
  const positions = new Float32Array(vw * vh * 3);
  const normals = new Float32Array(vw * vh * 3);
  const indices: number[] = [];

  for (let row = 0; row < vh; row++) {
    for (let col = 0; col < vw; col++) {
      const x = -VALLEY_HALF_W + (col / W) * xSpan;
      const z = VALLEY_Z_NEAR - (row / H) * zSpan;
      const y = hillHeight(x, z);
      const idx = (row * vw + col) * 3;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
      const eps = 0.5;
      const hx = hillHeight(x + eps, z) - hillHeight(x - eps, z);
      const hz = hillHeight(x, z + eps) - hillHeight(x, z - eps);
      let nx = -hx;
      const ny = 2 * eps;
      let nz = -hz;
      const len = Math.hypot(nx, ny, nz) || 1;
      normals[idx] = nx / len;
      normals[idx + 1] = ny / len;
      normals[idx + 2] = nz / len;
    }
  }

  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      const a = row * vw + col;
      const b = a + 1;
      const c = a + vw;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const g = new BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  g.computeBoundingSphere();
  return g;
}

function buildTerrainMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        // Dark mossy basin with subtle blue-grey moonlit highs.
        vec3 low  = vec3(0.025, 0.060, 0.040);
        vec3 high = vec3(0.060, 0.110, 0.090);
        float n = hash(floor(vWorldPos.xz * 1.7));
        vec3 col = mix(low, high, n * 0.6);
        // Slopes catch cool moonlight on north/up faces.
        float up = clamp(vNormal.y, 0.0, 1.0);
        col = mix(col, vec3(0.075, 0.115, 0.150), pow(up, 1.6) * 0.35);
        // Cool rim on side-facing slopes.
        float side = clamp(1.0 - vNormal.y, 0.0, 1.0);
        col += vec3(0.020, 0.040, 0.075) * side * 0.4;
        // Distance dim so the far valley fades softly into the sky.
        float depth = smoothstep(-200.0, -430.0, vWorldPos.z);
        col *= mix(1.0, 0.55, depth);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
  });
}

// --- Flower: low-poly version of the hepatica from Act I ------------------

const R_STEM = 0.05;
const R_PETAL = 0.40;
const R_CENTER = 0.75;

function buildValleyFlowerGeometry(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const localUs: number[] = [];
  const indices: number[] = [];

  // Stem
  const STEM_HEIGHT = 0.55;
  const STEM_RADIUS = 0.025;
  const STEM_SIDES = 4;
  const STEM_RINGS = 2;
  for (let ring = 0; ring <= STEM_RINGS; ring++) {
    const v = ring / STEM_RINGS;
    const y = v * STEM_HEIGHT;
    const r = STEM_RADIUS * (1 - 0.15 * v);
    for (let i = 0; i < STEM_SIDES; i++) {
      const a = (i / STEM_SIDES) * Math.PI * 2;
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uvs.push(R_STEM, v);
      localUs.push(i / STEM_SIDES);
    }
  }
  for (let ring = 0; ring < STEM_RINGS; ring++) {
    const base = ring * STEM_SIDES;
    const next = (ring + 1) * STEM_SIDES;
    for (let i = 0; i < STEM_SIDES; i++) {
      const b1 = base + i;
      const b2 = base + ((i + 1) % STEM_SIDES);
      const t1 = next + i;
      const t2 = next + ((i + 1) % STEM_SIDES);
      indices.push(b1, b2, t2, b1, t2, t1);
    }
  }

  // Petals: 6 rounded petals, lower-segment-count variant
  const PETALS = 6;
  const PETAL_LEN = 0.55;
  const PETAL_WIDTH = 0.18;
  const PETAL_BASE_OFFSET = 0.04;
  const PETAL_PITCH = -0.26;
  const PETAL_SEG_U = 2;
  const PETAL_SEG_V = 3;
  for (let petalIdx = 0; petalIdx < PETALS; petalIdx++) {
    const angle = (petalIdx / PETALS) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const cosP = Math.cos(PETAL_PITCH);
    const sinP = Math.sin(PETAL_PITCH);
    const baseIdx = positions.length / 3;
    for (let row = 0; row <= PETAL_SEG_V; row++) {
      const v = row / PETAL_SEG_V;
      const baseEnd = 0.28;
      const tipStart = 0.6;
      let wf: number;
      if (v < baseEnd) {
        const t = v / baseEnd;
        wf = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
      } else if (v < tipStart) {
        wf = 1;
      } else {
        const t = (v - tipStart) / (1 - tipStart);
        wf = Math.sqrt(Math.max(0, 1 - t * t));
      }
      const w = PETAL_WIDTH * wf;
      for (let col = 0; col <= PETAL_SEG_U; col++) {
        const u = col / PETAL_SEG_U;
        const lx = (u - 0.5) * 2 * w;
        const ly = PETAL_BASE_OFFSET + v * PETAL_LEN;
        const lz = 0;
        const py = cosP * ly + sinP * lz;
        const pz = -sinP * ly + cosP * lz;
        const wx = cosA * py - sinA * lx;
        const wz = sinA * py + cosA * lx;
        const wy = STEM_HEIGHT + pz;
        positions.push(wx, wy, wz);
        uvs.push(R_PETAL, v);
        localUs.push(u);
      }
    }
    const cols = PETAL_SEG_U + 1;
    for (let row = 0; row < PETAL_SEG_V; row++) {
      for (let col = 0; col < PETAL_SEG_U; col++) {
        const a = baseIdx + row * cols + col;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }
  }

  // Tiny white center
  const CENTER_R = 0.040;
  const C_RINGS = 3;
  const C_SEGS = 4;
  const cy = STEM_HEIGHT + 0.020;
  const cBase = positions.length / 3;
  for (let ring = 0; ring <= C_RINGS; ring++) {
    const phi = (ring / C_RINGS) * Math.PI;
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    for (let seg = 0; seg <= C_SEGS; seg++) {
      const th = (seg / C_SEGS) * Math.PI * 2;
      positions.push(CENTER_R * sp * Math.cos(th), cy + CENTER_R * cp, CENTER_R * sp * Math.sin(th));
      uvs.push(R_CENTER, ring / C_RINGS);
      localUs.push(0.5);
    }
  }
  const ccols = C_SEGS + 1;
  for (let ring = 0; ring < C_RINGS; ring++) {
    for (let seg = 0; seg < C_SEGS; seg++) {
      const a = cBase + ring * ccols + seg;
      const b = a + 1;
      const c = a + ccols;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
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

function buildValleyFlowerMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSeed;
      attribute float aLocalU;
      uniform float uTime;
      varying vec3 vColor;
      varying float vRegion;
      varying float vU;
      varying float vLocalU;
      varying vec3 vNormal;
      void main() {
        vColor = aColor;
        vRegion = uv.x;
        vU = uv.y;
        vLocalU = aLocalU;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        float headMask = smoothstep(0.30, 0.60, position.y);
        p.x += sin(uTime * 0.8 + aSeed * 6.28) * 0.012 * headMask;
        p.z += cos(uTime * 0.6 + aSeed * 6.28) * 0.012 * headMask;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vRegion;
      varying float vU;
      varying float vLocalU;
      varying vec3 vNormal;
      void main() {
        vec3 col;
        if (vRegion < 0.20) {
          vec3 stemA = vec3(0.060, 0.165, 0.080);
          vec3 stemB = vec3(0.030, 0.105, 0.055);
          col = mix(stemB, stemA, vU);
          col += vec3(0.04, 0.10, 0.18) * smoothstep(0.5, 1.0, vU) * 0.5;
        } else if (vRegion < 0.55) {
          vec3 base = vColor * 0.95;
          vec3 tip  = vColor * 0.72;
          col = mix(base, tip, vU);
          float lateral = abs(vLocalU - 0.5) * 2.0;
          col *= (1.0 - pow(lateral, 1.4) * 0.55);
          float spine = 1.0 - smoothstep(0.0, 0.12, lateral);
          col += vColor * spine * 0.30 * sin(vU * 3.14159);
          col *= 1.4; // emissive lift so flowers glow in dim valley light
        } else {
          // White-ish center.
          col = vec3(0.92, 0.94, 1.00);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
  });
}

// --- Lavender: tall stem with a bumpy purple raceme ----------------------

const RL_STEM = 0.1;
const RL_SPIKE = 0.6;

function buildLavenderGeometry(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const STEM_HEIGHT = 0.78;
  const STEM_RADIUS = 0.018;
  const STEM_SIDES = 4;
  const STEM_RINGS = 3;
  for (let ring = 0; ring <= STEM_RINGS; ring++) {
    const v = ring / STEM_RINGS;
    const y = v * STEM_HEIGHT;
    const r = STEM_RADIUS * (1 - 0.18 * v);
    for (let i = 0; i < STEM_SIDES; i++) {
      const a = (i / STEM_SIDES) * Math.PI * 2;
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uvs.push(RL_STEM, v);
    }
  }
  for (let ring = 0; ring < STEM_RINGS; ring++) {
    const base = ring * STEM_SIDES;
    const next = (ring + 1) * STEM_SIDES;
    for (let i = 0; i < STEM_SIDES; i++) {
      const b1 = base + i;
      const b2 = base + ((i + 1) % STEM_SIDES);
      const t1 = next + i;
      const t2 = next + ((i + 1) % STEM_SIDES);
      indices.push(b1, b2, t2, b1, t2, t1);
    }
  }

  // Spike: tapered cylinder with per-ring bumpy radius + azimuthal lobes so
  // the silhouette reads as a cluster of florets, not a smooth cone.
  const SPIKE_BASE_Y = STEM_HEIGHT;
  const SPIKE_TIP_Y = STEM_HEIGHT + 0.55;
  const SPIKE_R = 0.075;
  const SPIKE_SIDES = 5;
  const SPIKE_RINGS = 9;
  const spikeBase = positions.length / 3;
  for (let ring = 0; ring <= SPIKE_RINGS; ring++) {
    const v = ring / SPIKE_RINGS;
    const y = SPIKE_BASE_Y + v * (SPIKE_TIP_Y - SPIKE_BASE_Y);
    let r = SPIKE_R * (1 - v * 0.72);
    // discrete floret bumps along the length
    const bump = Math.sin(ring * 1.9) * 0.55 + Math.cos(ring * 3.1) * 0.30;
    r *= 1 + bump * 0.35;
    for (let i = 0; i < SPIKE_SIDES; i++) {
      const a = (i / SPIKE_SIDES) * Math.PI * 2;
      // azimuthal lobes so the spike isn't axisymmetric
      const lobe = 1 + Math.sin(a * 3 + ring * 0.6) * 0.22;
      positions.push(Math.cos(a) * r * lobe, y, Math.sin(a) * r * lobe);
      uvs.push(RL_SPIKE, v);
    }
  }
  for (let ring = 0; ring < SPIKE_RINGS; ring++) {
    const base = spikeBase + ring * SPIKE_SIDES;
    const next = spikeBase + (ring + 1) * SPIKE_SIDES;
    for (let i = 0; i < SPIKE_SIDES; i++) {
      const b1 = base + i;
      const b2 = base + ((i + 1) % SPIKE_SIDES);
      const t1 = next + i;
      const t2 = next + ((i + 1) % SPIKE_SIDES);
      indices.push(b1, b2, t2, b1, t2, t1);
    }
  }
  // Tip cap
  const tipIdx = positions.length / 3;
  positions.push(0, SPIKE_TIP_Y + 0.02, 0);
  uvs.push(RL_SPIKE, 1.0);
  const lastRing = spikeBase + SPIKE_RINGS * SPIKE_SIDES;
  for (let i = 0; i < SPIKE_SIDES; i++) {
    indices.push(lastRing + i, lastRing + ((i + 1) % SPIKE_SIDES), tipIdx);
  }

  const g = new BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function buildLavenderMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute vec3 aColor;
      uniform float uTime;
      varying vec3 vColor;
      varying float vRegion;
      varying float vY;
      varying vec3 vNormal;
      void main() {
        vColor = aColor;
        vRegion = uv.x;
        vY = uv.y;
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        // Whole spike sways gently; stem stays planted.
        float swayMask = smoothstep(0.45, 1.30, position.y);
        p.x += sin(uTime * 0.85 + aSeed * 6.28) * 0.030 * swayMask;
        p.z += cos(uTime * 0.72 + aSeed * 6.28) * 0.030 * swayMask;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vRegion;
      varying float vY;
      varying vec3 vNormal;
      void main() {
        vec3 col;
        if (vRegion < 0.4) {
          // Mossy stem
          vec3 stemA = vec3(0.045, 0.115, 0.055);
          vec3 stemB = vec3(0.080, 0.165, 0.090);
          col = mix(stemA, stemB, vY);
        } else {
          // Purple-violet raceme. Brighter, more saturated toward the tip.
          vec3 base = vColor * 0.78;
          vec3 tip  = vColor * 1.20;
          col = mix(base, tip, vY);
          // Floret banding — bright rings where individual florets sit.
          float band = sin(vY * 30.0) * 0.5 + 0.5;
          col = mix(col, vColor * 1.30, pow(band, 3.0) * 0.55);
          float up = clamp(vNormal.y, 0.0, 1.0);
          col *= mix(0.85, 1.12, up);
          col *= 1.35; // emissive lift to match the cobalt flowers
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
  });
}

// --- Grass blade: curved tapered ribbon ----------------------------------

function buildGrassGeometry(): BufferGeometry {
  const SEGS = 4;
  const HEIGHT = 0.32;
  const BASE_W = 0.022;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= SEGS; i++) {
    const v = i / SEGS;
    const w = BASE_W * (1 - Math.pow(v, 1.4));
    // Gentle forward curl in +z so blades arc instead of standing straight.
    const curl = Math.sin(v * Math.PI * 0.6) * 0.08;
    const y = v * HEIGHT;
    positions.push(-w, y, curl);
    uvs.push(0, v);
    positions.push(+w, y, curl);
    uvs.push(1, v);
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

function buildGrassMaterial(): ShaderMaterial {
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
        p.x += sin(uTime * 1.1 + aSeed * 6.28) * 0.020 * tipMask;
        p.z += cos(uTime * 0.9 + aSeed * 6.28) * 0.020 * tipMask;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vV;
      varying vec3 vNormal;
      void main() {
        vec3 dark  = vec3(0.025, 0.075, 0.040);
        vec3 mid   = vec3(0.055, 0.135, 0.075);
        vec3 tip   = vec3(0.090, 0.180, 0.110);
        vec3 col = mix(dark, mid, smoothstep(0.0, 0.6, vV));
        col = mix(col, tip, smoothstep(0.7, 1.0, vV));
        // Cool moonlit rim on side-facing surfaces.
        float side = clamp(1.0 - abs(vNormal.y), 0.0, 1.0);
        col += vec3(0.012, 0.026, 0.045) * side * 0.6;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
  });
}

// --- Twig: short bent bark stick -----------------------------------------

function buildTwigGeometry(): BufferGeometry {
  const SIDES = 4;
  const RINGS = 4;
  const LENGTH = 0.40;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring <= RINGS; ring++) {
    const v = ring / RINGS;
    const x = v * LENGTH;
    // taper + slight bend so twigs aren't straight rods
    const r = 0.014 * (1 - 0.5 * v);
    const bendY = Math.sin(v * Math.PI * 0.85) * 0.05;
    for (let i = 0; i < SIDES; i++) {
      const a = (i / SIDES) * Math.PI * 2;
      positions.push(x, bendY + Math.cos(a) * r, Math.sin(a) * r);
      uvs.push(v, i / SIDES);
    }
  }
  for (let ring = 0; ring < RINGS; ring++) {
    const base = ring * SIDES;
    const next = (ring + 1) * SIDES;
    for (let i = 0; i < SIDES; i++) {
      const b1 = base + i;
      const b2 = base + ((i + 1) % SIDES);
      const t1 = next + i;
      const t2 = next + ((i + 1) % SIDES);
      indices.push(b1, b2, t2, b1, t2, t1);
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

function buildTwigMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 barkDark = vec3(0.050, 0.030, 0.018);
        vec3 barkLight = vec3(0.110, 0.075, 0.045);
        float n = hash(floor(vUv * vec2(48.0, 12.0)));
        vec3 col = mix(barkDark, barkLight, n * 0.6 + 0.25);
        float face = clamp(abs(vNormal.x) + abs(vNormal.z) * 0.5, 0.0, 1.0);
        col *= mix(0.7, 1.05, face);
        col += vec3(0.010, 0.022, 0.038) * face * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
  });
}

// --- Fireflies (valley-local) ---------------------------------------------

function buildValleyFireflyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSize: { value: 5.5 } },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      uniform float uTime;
      uniform float uSize;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.45 + aSeed.x * 6.2831) * 0.7;
        p.y += sin(uTime * 0.38 + aSeed.y * 6.2831) * 0.30;
        p.z += cos(uTime * 0.52 + aSeed.z * 6.2831) * 0.7;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (200.0 / -mv.z);
        vAlpha = 0.40 + 0.55 * sin(uTime * 1.8 + aSeed.x * 6.2831);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float dist = length(d);
        if (dist > 0.5) discard;
        float intensity = smoothstep(0.5, 0.0, dist);
        vec3 gold = vec3(0.90, 0.74, 0.38);
        gl_FragColor = vec4(gold * intensity * vAlpha, intensity * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

// Scroll range during which the valley is visible. Outside this range the
// whole subtree is set to invisible so its vertex shaders don't run.
const VALLEY_VISIBLE_FROM = 0.70;

export default function Valley() {
  const groupRef = useRef<Group>(null);
  const flowersRef = useRef<InstancedMesh>(null);
  const lavendersRef = useRef<InstancedMesh>(null);
  const flowerGeom = useMemo(() => buildValleyFlowerGeometry(), []);
  const flowerMat = useMemo(() => buildValleyFlowerMaterial(), []);
  const lavenderGeom = useMemo(() => buildLavenderGeometry(), []);
  const lavenderMat = useMemo(() => buildLavenderMaterial(), []);
  const grassRef = useRef<InstancedMesh>(null);
  const twigRef = useRef<InstancedMesh>(null);
  const grassGeom = useMemo(() => buildGrassGeometry(), []);
  const grassMat = useMemo(() => buildGrassMaterial(), []);
  const twigGeom = useMemo(() => buildTwigGeometry(), []);
  const twigMat = useMemo(() => buildTwigMaterial(), []);
  const terrainGeom = useMemo(() => bakeTerrainGeometry(), []);
  const terrainMat = useMemo(() => buildTerrainMaterial(), []);
  const fireflyMat = useMemo(() => buildValleyFireflyMaterial(), []);
  const fireflyGeom = useMemo(() => {
    const g = new BufferGeometry();
    const positions = new Float32Array(FIREFLY_COUNT * 3);
    const seeds = new Float32Array(FIREFLY_COUNT * 3);
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const x = (Math.random() - 0.5) * VALLEY_HALF_W * 2;
      const z = VALLEY_Z_NEAR - Math.random() * VALLEY_DEPTH;
      const ground = hillHeight(x, z);
      // Hover just above the flower heads (hepatica ~1.0, lavender ~1.3),
      // with a shallow vertical band so the swarm reads as a layer over the
      // carpet rather than a 3D cloud.
      const y = ground + 0.85 + Math.random() * 1.25;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      seeds[i * 3] = Math.random();
      seeds[i * 3 + 1] = Math.random();
      seeds[i * 3 + 2] = Math.random();
    }
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    g.setAttribute('aSeed', new Float32BufferAttribute(seeds, 3));
    return g;
  }, []);

  useEffect(() => {
    const mesh = flowersRef.current;
    if (!mesh) return;
    const m = new Matrix4();
    const pos = new Vector3();
    const q = new Quaternion();
    const e = new Euler();
    const scale = new Vector3();

    // Jittered grid scatter across the valley footprint.
    const aspectX = VALLEY_HALF_W * 2;
    const aspectZ = VALLEY_DEPTH;
    const cell = Math.sqrt((aspectX * aspectZ) / (FLOWER_COUNT * 1.2));
    const gridX = Math.ceil(aspectX / cell);
    const gridZ = Math.ceil(aspectZ / cell);
    const cells: number[] = [];
    for (let k = 0; k < gridX * gridZ; k++) cells.push(k);
    for (let k = cells.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [cells[k], cells[j]] = [cells[j], cells[k]];
    }

    const colors = new Float32Array(FLOWER_COUNT * 3);
    const seeds = new Float32Array(FLOWER_COUNT);
    const c = new Color();
    const realCount = Math.min(FLOWER_COUNT, cells.length);
    for (let i = 0; i < realCount; i++) {
      const idx = cells[i];
      const gx = idx % gridX;
      const gz = Math.floor(idx / gridX);
      const x = -VALLEY_HALF_W + (gx + 0.5) * cell + (Math.random() - 0.5) * cell * 0.75;
      const z = VALLEY_Z_NEAR - (gz + 0.5) * cell + (Math.random() - 0.5) * cell * 0.75;
      const y = hillHeight(x, z);
      pos.set(x, y, z);
      const pitch = (Math.random() - 0.5) * 0.30;
      const yaw = Math.random() * Math.PI * 2;
      const roll = (Math.random() - 0.5) * 0.30;
      e.set(pitch, yaw, roll, 'YXZ');
      q.setFromEuler(e);
      const s = 0.55 + Math.random() * 0.45;
      scale.set(s, s, s);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
      seeds[i] = Math.random();
      c.setHSL(0.64 + (Math.random() - 0.5) * 0.025, 1.0, 0.46 + Math.random() * 0.05);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    mesh.count = realCount;
    mesh.instanceMatrix.needsUpdate = true;
    flowerGeom.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    flowerGeom.setAttribute('aColor', new InstancedBufferAttribute(colors, 3));
  }, [flowerGeom]);

  // Scatter lavenders independently — taller, sparser, in patches.
  useEffect(() => {
    const mesh = lavendersRef.current;
    if (!mesh) return;
    const m = new Matrix4();
    const pos = new Vector3();
    const q = new Quaternion();
    const e = new Euler();
    const scale = new Vector3();
    const colors = new Float32Array(LAVENDER_COUNT * 3);
    const seeds = new Float32Array(LAVENDER_COUNT);
    const c = new Color();

    // Patch-based placement so lavenders cluster naturally rather than
    // dusting evenly across the entire valley.
    const PATCH_COUNT = 28;
    const patches: Array<{ x: number; z: number; r: number }> = [];
    for (let i = 0; i < PATCH_COUNT; i++) {
      patches.push({
        x: (Math.random() - 0.5) * VALLEY_HALF_W * 1.7,
        z: VALLEY_Z_NEAR - 25 - Math.random() * (VALLEY_DEPTH - 40),
        r: 10 + Math.random() * 18,
      });
    }

    let placed = 0;
    let safety = 0;
    while (placed < LAVENDER_COUNT && safety < LAVENDER_COUNT * 6) {
      safety++;
      const patch = patches[Math.floor(Math.random() * PATCH_COUNT)];
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * patch.r;
      const x = patch.x + Math.cos(ang) * rad;
      const z = patch.z + Math.sin(ang) * rad;
      if (Math.abs(x) > VALLEY_HALF_W - 2) continue;
      if (z > VALLEY_Z_NEAR || z < VALLEY_Z_FAR) continue;
      const y = hillHeight(x, z);
      pos.set(x, y, z);
      const pitch = (Math.random() - 0.5) * 0.18;
      const yaw = Math.random() * Math.PI * 2;
      const roll = (Math.random() - 0.5) * 0.18;
      e.set(pitch, yaw, roll, 'YXZ');
      q.setFromEuler(e);
      const s = 0.75 + Math.random() * 0.55;
      scale.set(s, s * (0.92 + Math.random() * 0.20), s);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(placed, m);
      seeds[placed] = Math.random();
      // Lavender hues: violet (~0.74) through purple-magenta (~0.80).
      c.setHSL(0.74 + Math.random() * 0.06, 0.78, 0.50 + Math.random() * 0.08);
      colors[placed * 3] = c.r;
      colors[placed * 3 + 1] = c.g;
      colors[placed * 3 + 2] = c.b;
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    lavenderGeom.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    lavenderGeom.setAttribute('aColor', new InstancedBufferAttribute(colors, 3));
  }, [lavenderGeom]);

  // Grass + twigs — dense scatter across the whole valley floor.
  useEffect(() => {
    const gmesh = grassRef.current;
    const tmesh = twigRef.current;
    if (!gmesh || !tmesh) return;
    const m = new Matrix4();
    const pos = new Vector3();
    const q = new Quaternion();
    const e = new Euler();
    const scale = new Vector3();

    const grassSeeds = new Float32Array(GRASS_COUNT);
    for (let i = 0; i < GRASS_COUNT; i++) {
      const x = (Math.random() - 0.5) * VALLEY_HALF_W * 2;
      const z = VALLEY_Z_NEAR - Math.random() * VALLEY_DEPTH;
      const y = hillHeight(x, z);
      pos.set(x, y, z);
      const pitch = (Math.random() - 0.5) * 0.22;
      const yaw = Math.random() * Math.PI * 2;
      const roll = (Math.random() - 0.5) * 0.22;
      e.set(pitch, yaw, roll, 'YXZ');
      q.setFromEuler(e);
      const s = 0.7 + Math.random() * 0.7;
      scale.set(s, s * (0.85 + Math.random() * 0.4), s);
      m.compose(pos, q, scale);
      gmesh.setMatrixAt(i, m);
      grassSeeds[i] = Math.random();
    }
    gmesh.count = GRASS_COUNT;
    gmesh.instanceMatrix.needsUpdate = true;
    grassGeom.setAttribute('aSeed', new InstancedBufferAttribute(grassSeeds, 1));

    for (let i = 0; i < TWIG_COUNT; i++) {
      const x = (Math.random() - 0.5) * VALLEY_HALF_W * 2;
      const z = VALLEY_Z_NEAR - Math.random() * VALLEY_DEPTH;
      const y = hillHeight(x, z);
      // Twigs lie almost flat on the ground with a small tilt.
      pos.set(x, y + 0.005, z);
      const tilt = (Math.random() - 0.5) * 0.25;
      const yaw = Math.random() * Math.PI * 2;
      const roll = (Math.random() - 0.5) * 0.25;
      e.set(tilt, yaw, roll, 'YXZ');
      q.setFromEuler(e);
      const s = 0.6 + Math.random() * 1.1;
      scale.set(s, s, s);
      m.compose(pos, q, scale);
      tmesh.setMatrixAt(i, m);
    }
    tmesh.count = TWIG_COUNT;
    tmesh.instanceMatrix.needsUpdate = true;
  }, [grassGeom]);

  useFrame((state) => {
    const s = useAppStore.getState().scrollProgress;
    const visible = s >= VALLEY_VISIBLE_FROM;
    if (groupRef.current) groupRef.current.visible = visible;
    if (!visible) return;
    const t = state.clock.elapsedTime;
    flowerMat.uniforms.uTime.value = t;
    lavenderMat.uniforms.uTime.value = t;
    grassMat.uniforms.uTime.value = t;
    fireflyMat.uniforms.uTime.value = t;
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh
        geometry={terrainGeom}
        material={terrainMat}
        frustumCulled={false}
      />
      <instancedMesh
        ref={flowersRef}
        args={[flowerGeom, flowerMat, FLOWER_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={lavendersRef}
        args={[lavenderGeom, lavenderMat, LAVENDER_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={grassRef}
        args={[grassGeom, grassMat, GRASS_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={twigRef}
        args={[twigGeom, twigMat, TWIG_COUNT]}
        frustumCulled={false}
      />
      <points geometry={fireflyGeom} material={fireflyMat} frustumCulled={false} />
    </group>
  );
}
