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
import { PALETTES } from './themePalette';

// Basin color is fixed (not theme-dependent) so the riverbank substrate
// matches the world ground in every mode and never re-tints when the
// theme changes.
const BASIN_COLOR = PALETTES.night.ground;

const RIVER_VISIBLE_FROM = 0.00;
const RIVER_VISIBLE_TO = 0.90;
import {
  riverCurve,
  riverLightPositions,
  RIVER_LIGHT_COLOR,
  RIVER_LIGHT_RANGE,
} from './riverLights';

// Silver/bioluminescent river. Crosses the camera path between the flower
// field (Act I) and the dark forest (Act II) at z ≈ -25 so the camera flies
// directly over its widest section at scroll ≈ 0.68 — the "bridge moment".

const RIVER_WIDTH = 11.0;
const SEGMENTS_LEN = 220;
const SEGMENTS_W = 1;

// Independent multi-octave wobble functions for left & right banks. Different
// frequencies/phases per side so the river never reads as symmetric — banks
// meander, narrow, widen, and pinch like a real watercourse.
function leftBankWobble(t: number): number {
  return (
    Math.sin(t * Math.PI * 7.3 + 0.7) * 0.45 +
    Math.sin(t * Math.PI * 17.1 + 2.3) * 0.22 +
    Math.sin(t * Math.PI * 37.5 + 4.1) * 0.10 +
    Math.sin(t * Math.PI * 81.7 + 5.7) * 0.04
  );
}
function rightBankWobble(t: number): number {
  return (
    Math.sin(t * Math.PI * 8.1 + 1.5) * 0.45 +
    Math.sin(t * Math.PI * 19.3 + 3.1) * 0.22 +
    Math.sin(t * Math.PI * 41.7 + 5.2) * 0.10 +
    Math.sin(t * Math.PI * 89.3 + 2.4) * 0.04
  );
}
// Bank wobble amplitude in world units. Larger = more meandering edges.
const BANK_WOBBLE_AMP = 2.4;

// Build a wide "wet earth" strip following the river curve. Sits a hair
// below the water so it reads as the bank/basin material under the
// dissolved river edge and the wobbling banks. Width is generous so the
// strip extends well past the rocks and meander excursion — no gap to
// the surrounding forest ground.
function buildBasinGeometry(): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  const tangent = new Vector3();
  const up = new Vector3(0, 1, 0);
  const side = new Vector3();
  const point = new Vector3();
  const BASIN_HALF_WIDTH = 14; // extends ~6 units past the widest meander

  for (let i = 0; i <= SEGMENTS_LEN; i++) {
    const t = i / SEGMENTS_LEN;
    riverCurve.getPoint(t, point);
    riverCurve.getTangent(t, tangent).normalize();
    side.crossVectors(tangent, up).normalize();
    for (let j = 0; j <= 1; j++) {
      const u = j;
      const off = (u - 0.5) * 2 * BASIN_HALF_WIDTH;
      // Basin Y is chosen to sit in the clear band between two neighbours:
      //   • well above the world ground plane (y=-0.02), so it shows as the
      //     wet-earth substrate on the flower-field side, and
      //   • decisively below the Valley terrain's near edge (min y≈0.05),
      //     so where the two overlap on the FOREST side (z ≈ -32 → -39) the
      //     terrain always wins the depth test and cleanly occludes the
      //     basin — no coplanar z-fighting. 0.01 keeps ~0.03 of clearance to
      //     the ground below and ~0.04 to the terrain above, both far larger
      //     than the depth-buffer epsilon at this viewing distance.
      positions.push(point.x + side.x * off, 0.01, point.z + side.z * off);
    }
  }
  for (let i = 0; i < SEGMENTS_LEN; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, d, a, d, c);
  }
  const g = new BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

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

    // Per-side bank perturbation — left and right edges wander independently.
    // Taper the wobble to zero at the very start and end of the river so the
    // endpoints stay clean against neighbouring scenery.
    const endTaper = Math.min(t, 1 - t) * 4;
    const taper = Math.min(1, endTaper);
    const leftWob  = leftBankWobble(t)  * BANK_WOBBLE_AMP * taper;
    const rightWob = rightBankWobble(t) * BANK_WOBBLE_AMP * taper;

    for (let j = 0; j <= SEGMENTS_W; j++) {
      const u = j / SEGMENTS_W;
      // Asymmetric bank perturbation: the left edge (u=0) gets pushed by
      // leftWob, the right edge (u=1) by rightWob. Interior vertices (if
      // any) get a smooth blend so the surface deforms continuously.
      const leftEdge  = -w * 0.5 - leftWob;
      const rightEdge =  w * 0.5 + rightWob;
      const off = leftEdge + (rightEdge - leftEdge) * u;
      const px = point.x + side.x * off;
      const py = 0.14;
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
      // Moon position must match Moon.tsx (MOON_POS)
      uMoonPos: { value: new Vector3(0, 88, -490) },
      uMoonColor: { value: new Vector3(0.50, 0.68, 1.20) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec3 p = position;
        // Gentle vertex displacement for low-frequency swell — most surface
        // detail comes from fragment-stage normal perturbation, so this can
        // stay subtle.
        float swell = sin(uv.y * 6.0 - uTime * 0.5) * 0.020
                    + sin(uv.x * 3.5 + uTime * 0.35) * 0.012;
        p.y += swell;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uMoonPos;
      uniform vec3 uMoonColor;
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
      // 2-octave fbm — was 4. The visible water surface is busy enough
      // from the layered waveHeight samples below; the extra octaves were
      // burning fragment time without a perceptible quality gain.
      float fbm(vec2 p) {
        float v = vnoise(p) * 0.6;
        v += vnoise(p * 2.07 + vec2(3.7, 1.9)) * 0.3;
        return v;
      }

      // Height-field in UV-flow space: u runs across the river, v runs
      // downstream along the curve. Subtracting time from v makes the
      // entire wave pattern advect downstream. Three layered scales with
      // increasing speed give the look of small wavelets riding on slow
      // swells. A tiny cross-shear keeps it from feeling like a conveyor.
      // Two wave scales instead of three. The dropped fine scale (c) was
      // mostly invisible past a few meters and read as noise per-pixel.
      float waveHeight(vec2 uv) {
        vec2 a = vec2(uv.x *  6.0, uv.y *  20.0 - uTime * 1.30);
        vec2 b = vec2(uv.x * 14.0 + uTime * 0.18, uv.y * 48.0 - uTime * 2.10);
        return fbm(a) * 0.65 + fbm(b) * 0.35;
      }

      // Sky color sampled along a reflected ray direction. Dark blue zenith,
      // very faint horizon lift; star sparkle modulated by hash noise so the
      // reflection picks up flickering pinpricks.
      vec3 skyColor(vec3 dir) {
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 zenith  = vec3(0.020, 0.045, 0.110);
        vec3 horizon = vec3(0.045, 0.085, 0.180);
        vec3 c = mix(horizon, zenith, smoothstep(0.0, 0.6, h));
        // Pseudo-stars: hash the direction grid; only very few cells light up.
        vec2 sphereUV = vec2(atan(dir.z, dir.x), dir.y);
        float starCell = hash(floor(sphereUV * 220.0));
        float star = pow(starCell, 90.0) * 1.6;
        c += vec3(0.6, 0.7, 0.95) * star * smoothstep(0.05, 0.4, h);
        return c;
      }

      void main() {
        // --- Surface normal from fbm gradient in UV-flow space -----------
        // Sampling in UV means the wave pattern follows the river curve;
        // time drift in waveHeight advects the entire field downstream.
        float eps = 0.0035;
        float h0 = waveHeight(vUv);
        float hu = waveHeight(vUv + vec2(eps, 0.0));
        float hv = waveHeight(vUv + vec2(0.0, eps));

        // Two normal scales: a CALM normal for fresnel & body reading
        // (keeps the surface looking glass-flat from above) and a
        // CHOPPY normal for specular/glitter (breaks the moon highlight
        // into dancing pinpoints rather than a flat smear).
        float steepCalm   = 0.020;
        float steepChoppy = 0.18;
        vec3 Ncalm   = normalize(vec3(-(hu - h0) / eps * steepCalm,   1.0, -(hv - h0) / eps * steepCalm));
        vec3 Nchoppy = normalize(vec3(-(hu - h0) / eps * steepChoppy, 1.0, -(hv - h0) / eps * steepChoppy));

        vec3 V = normalize(vViewDir);
        vec3 R = reflect(-V, Ncalm);

        // --- Fresnel (Schlick), water F0 ≈ 0.02 -------------------------
        float NdotV = clamp(dot(Ncalm, V), 0.0, 1.0);
        float fres = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);

        // --- Reflection: dark night sky + bright moon disc + halo -------
        vec3 reflCol = skyColor(R);
        vec3 toMoon = normalize(uMoonPos - vWorldPos);
        float moonDot = dot(R, toMoon);
        float moonDisc = smoothstep(0.9985, 0.9998, moonDot);
        float moonHalo = pow(max(0.0, moonDot), 220.0);
        reflCol += uMoonColor * moonDisc * 4.0;
        reflCol += uMoonColor * moonHalo * 0.55;

        // --- Body: clear glass over dark depth --------------------------
        // Nearly black so the surface reads as transparent water above a
        // deep, unlit substrate. All visible character now comes from the
        // reflection layer (sky, moon, halo, trail, specular, glitter).
        vec3 deep = vec3(0.006, 0.010, 0.014);
        vec3 mid  = vec3(0.020, 0.028, 0.034);
        vec3 glow = vec3(0.12, 0.15, 0.17);
        float depthMix = smoothstep(0.0, 1.0, h0);
        vec3 bodyCol = mix(deep, mid, depthMix);

        // Caustic veins kept extremely subtle — like faint refraction
        // bands through clear water, not glowing cyan ribbons.
        float caustic = pow(0.5 + 0.5 * sin((h0 * 8.0 + vUv.y * 30.0) - uTime * 2.8), 5.0);
        bodyCol += glow * caustic * 0.10;
        float shimmer = pow(0.5 + 0.5 * sin(h0 * 14.0 - uTime * 1.8), 4.0);
        bodyCol += vec3(0.06, 0.07, 0.08) * shimmer * 0.15;

        // --- Moon-glitter: dancing sparkles along the moon's reflection
        //     path. Uses the choppy normal so most fragments are dark and
        //     only those whose normal happens to bisect view & moon fire.
        vec3 Hch = normalize(toMoon + V);
        float NdotH_choppy = max(0.0, dot(Nchoppy, Hch));
        float glitter = pow(NdotH_choppy, 320.0) * 12.0;

        // --- Sharp moon highlight on the calm normal --------------------
        vec3 Hc = normalize(toMoon + V);
        float NdotH_calm = max(0.0, dot(Ncalm, Hc));
        float specSharp  = pow(NdotH_calm, 220.0) * 2.2;
        float specBroad  = pow(NdotH_calm,  40.0) * 0.30;

        // --- Moon trail: a bright streak running across the water from
        //     each fragment toward the moon's ground-projected azimuth.
        //     This sells the 'moonlight on water' read regardless of the
        //     exact specular geometry.
        vec2 moonAz = normalize(uMoonPos.xz - vWorldPos.xz);
        vec2 fromBasin = vWorldPos.xz - vec2(0.0, -25.0);
        // Perpendicular distance from this fragment to the moon-azimuth
        // line through the basin center.
        vec2 perp = vec2(-moonAz.y, moonAz.x);
        float lateralDist = abs(dot(fromBasin, perp));
        // Width of the trail varies with downstream flow + ripple noise
        float trailNoise = fbm(vec2(vUv.x * 14.0, vUv.y * 6.0 - uTime * 0.6));
        float trailWidth = 3.5 + trailNoise * 4.0;
        float trail = exp(-(lateralDist * lateralDist) / (trailWidth * trailWidth));
        // Trail only on the moon-facing side
        float along = dot(normalize(fromBasin + vec2(0.001)), moonAz);
        trail *= smoothstep(-0.1, 0.4, along);
        // Modulate trail with ripples so it sparkles instead of being uniform
        float trailRipple = 0.5 + 0.5 * sin(h0 * 26.0 + uTime * 0.9);
        trail *= 0.4 + 0.6 * trailRipple;

        // --- Compose ----------------------------------------------------
        // Glass model: dark body shows through where fresnel is low (looking
        // straight down), while reflections take over at grazing angles.
        // Reflections are NOT clamped against the body — clear glass lets
        // the moon and sky add their full intensity on top of the dark depth.
        // A small floor on fresnel keeps a faint sheen even on flat areas.
        float reflMix = clamp(fres + 0.05, 0.0, 1.0);
        vec3 col = mix(bodyCol, reflCol, reflMix);
        col += uMoonColor * (specSharp + specBroad + glitter);
        col += uMoonColor * trail * 0.85;

        // --- Drifting foam streaks along the flow -----------------------
        float streak1 = fbm(vec2(vUv.x * 22.0, vUv.y * 4.5 - uTime * 1.90));
        float streak2 = fbm(vec2(vUv.x * 38.0 + 7.0, vUv.y * 2.2 - uTime * 2.70));
        float streakMask = smoothstep(0.62, 0.85, streak1) * smoothstep(0.55, 0.80, streak2);
        float calm = 1.0 - smoothstep(0.0, 0.30, abs(hu - h0) + abs(hv - h0));
        vec3 foamCol = vec3(0.65, 0.85, 1.00);

        // Bank fade so the river hugs the basin shape.
        float bankFade = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 3.0);
        col *= mix(0.78, 1.0, bankFade);
        col += foamCol * streakMask * calm * bankFade * 0.30;

        // ── Edge dissolve ───────────────────────────────────────────────
        // The river's geometric edge is broken up by a noisy alpha mask:
        // distance from the bank is offset by an fbm so the bank line
        // reads as natural shoreline (wet patches, fingers of water)
        // instead of a clean cut. Wider transition zone => softer edge.
        float distFromBank = 1.0 - abs(vUv.x - 0.5) * 2.0; // 1 at center, 0 at edge
        float edgeNoise = fbm(vec2(vUv.y * 28.0, vUv.x * 14.0 + uTime * 0.05));
        float edgeMask = smoothstep(0.0, 0.18, distFromBank + (edgeNoise - 0.5) * 0.18);

        gl_FragColor = vec4(col, edgeMask);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
  });
}

// --- Riverbank rocks: faceted icosahedron-ish geometry with per-vertex
// noise displacement so each rock reads as irregular. Three size classes
// (boulders, mid rocks, pebbles) scatter along both banks.

function buildRockGeometry(seed: number, lumpiness: number): BufferGeometry {
  // Subdivided octahedron — light geometry, faceted look once normals are
  // re-computed after displacement.
  const positions: number[] = [];
  const indices: number[] = [];
  const RINGS = 6;
  // Build a sphere via lat/long, then displace radially with hashed noise.
  const verts: Array<[number, number, number]> = [];
  for (let i = 0; i <= RINGS; i++) {
    const v = i / RINGS;
    const phi = v * Math.PI;
    const ringCount = Math.max(3, Math.round(Math.sin(phi) * RINGS * 2) + 2);
    for (let j = 0; j < ringCount; j++) {
      const u = j / ringCount;
      const theta = u * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      // Multi-frequency hash displacement so rocks look chunky.
      const h1 = Math.sin(x * 4.1 + y * 3.7 + z * 5.3 + seed) * 0.5 + 0.5;
      const h2 = Math.sin(x * 9.3 - y * 8.1 + z * 11.7 + seed * 3.1) * 0.5 + 0.5;
      const r = 1.0 + (h1 - 0.5) * lumpiness + (h2 - 0.5) * lumpiness * 0.4;
      // Flatten the bottom slightly so rocks sit on the ground.
      const flatten = y < -0.3 ? (y + 0.3) * 0.6 : 0;
      verts.push([x * r, y * r + flatten, z * r]);
    }
  }
  // Triangulate by nearest neighbors — simpler: re-sphere with regular grid.
  // Easier approach: use a regular lat/long grid with constant ring count.
  positions.length = 0;
  const RINGS2 = 7;
  const SEGS = 10;
  for (let i = 0; i <= RINGS2; i++) {
    const v = i / RINGS2;
    const phi = v * Math.PI;
    for (let j = 0; j <= SEGS; j++) {
      const u = j / SEGS;
      const theta = u * Math.PI * 2;
      const sx = Math.sin(phi) * Math.cos(theta);
      const sy = Math.cos(phi);
      const sz = Math.sin(phi) * Math.sin(theta);
      const h1 = Math.sin(sx * 4.1 + sy * 3.7 + sz * 5.3 + seed) * 0.5 + 0.5;
      const h2 = Math.sin(sx * 9.3 - sy * 8.1 + sz * 11.7 + seed * 3.1) * 0.5 + 0.5;
      const h3 = Math.sin(sx * 19.0 + sy * 17.0 - sz * 23.0 + seed * 7.0) * 0.5 + 0.5;
      const r = 1.0 + (h1 - 0.5) * lumpiness + (h2 - 0.5) * lumpiness * 0.45 + (h3 - 0.5) * 0.10;
      // Flatten the bottom slightly so rocks sit on the ground.
      const flatten = sy < -0.2 ? (sy + 0.2) * 0.7 : 0;
      positions.push(sx * r, sy * r + flatten, sz * r);
    }
  }
  const cols = SEGS + 1;
  for (let i = 0; i < RINGS2; i++) {
    for (let j = 0; j < SEGS; j++) {
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
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function buildRockMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMoonPos: { value: new Vector3(0, 88, -490) },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute vec3 aTint;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPos;
      varying float vSeed;
      varying vec3 vTint;
      void main() {
        vSeed = aSeed;
        vTint = aTint;
        vLocalPos = position;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uMoonPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPos;
      varying float vSeed;
      varying vec3 vTint;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float vnoise3(vec3 p) {
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
          mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
          mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
          f.z
        );
      }
      void main() {
        // Stone grain: layered 3D noise on local coords so the texture is
        // anchored to the rock (rotates with it).
        float g1 = vnoise3(vLocalPos * 3.5 + vSeed * 7.0);
        float g2 = vnoise3(vLocalPos * 11.0 + vSeed * 3.0);
        float g3 = vnoise3(vLocalPos * 28.0 + vSeed);
        float grain = g1 * 0.5 + g2 * 0.32 + g3 * 0.18;

        vec3 dark  = vec3(0.045, 0.045, 0.055) * vTint;
        vec3 mid   = vec3(0.135, 0.135, 0.155) * vTint;
        vec3 light = vec3(0.260, 0.260, 0.280) * vTint;

        vec3 col = mix(dark, mid, smoothstep(0.30, 0.65, grain));
        col = mix(col, light, smoothstep(0.70, 0.92, grain) * 0.7);

        // Coarse cracks/veins: tight stripe carved by another noise channel.
        float crack = smoothstep(0.48, 0.52, vnoise3(vLocalPos * 6.0 + 13.0));
        col *= mix(1.0, 0.78, crack);

        // Moss on the top: noise mask gated by up-facing surfaces, biased
        // near the waterline (low world Y).
        float up = clamp(vWorldNormal.y, 0.0, 1.0);
        float mossNoise = vnoise3(vWorldPos * 0.9 + vSeed);
        float mossMask = smoothstep(0.55, 0.78, mossNoise) * pow(up, 1.5);
        // Slight damp band right around y=0..0.4 (water spray zone)
        float damp = 1.0 - smoothstep(0.0, 1.2, vWorldPos.y);
        mossMask = clamp(mossMask + damp * 0.25 * smoothstep(0.45, 0.7, mossNoise), 0.0, 1.0);
        vec3 moss = vec3(0.045, 0.115, 0.055);
        col = mix(col, moss * (0.8 + 0.6 * mossNoise), mossMask * 0.85);

        // Diffuse moonlight from above
        vec3 toMoon = normalize(uMoonPos - vWorldPos);
        float lambert = clamp(dot(vWorldNormal, toMoon), 0.0, 1.0);
        col *= mix(0.55, 1.15, lambert);

        // Cool moonlit rim
        float rim = pow(1.0 - clamp(vWorldNormal.y, 0.0, 1.0), 2.5);
        col += vec3(0.020, 0.035, 0.060) * rim * 0.7;

        // Subtle cool underlight near the waterline — much fainter now
        // that the river itself reads as clear glass rather than cyan.
        float nearWater = 1.0 - smoothstep(0.0, 3.0, vWorldPos.y);
        col += vec3(0.018, 0.035, 0.050) * nearWater * 0.4;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    toneMapped: false,
  });
}

// Singleton geometry — built once, reused.
const basinGeometryFactory = () => buildBasinGeometry();

export default function BiolumeRiver() {
  const groupRef = useRef<Group>(null);
  const geometry = useMemo(() => buildRiverGeometry(), []);
  const basinGeometry = useMemo(() => basinGeometryFactory(), []);
  const material = useMemo(() => buildRiverMaterial(), []);
  const matRef = useRef(material);

  // Three rock classes: boulders (chunky, lumpy), mid rocks (rounded), and
  // pebbles (smoother, smaller). Each is a separate InstancedMesh because
  // they share a material but have distinct geometries.
  const boulderGeom = useMemo(() => buildRockGeometry(1.7, 0.32), []);
  const midRockGeom = useMemo(() => buildRockGeometry(4.3, 0.22), []);
  const pebbleGeom = useMemo(() => buildRockGeometry(9.1, 0.14), []);
  // Shore pebbles: tiny, smoother, packed densely right at the waterline
  // to break up the geometric edge of the river plane.
  const shoreGeom = useMemo(() => buildRockGeometry(13.7, 0.10), []);
  const rockMat = useMemo(() => buildRockMaterial(), []);
  const boulderRef = useRef<InstancedMesh>(null);
  const midRockRef = useRef<InstancedMesh>(null);
  const pebbleRef = useRef<InstancedMesh>(null);
  const shoreRef = useRef<InstancedMesh>(null);

  const BOULDER_COUNT = 500;
  const MID_ROCK_COUNT = 300;
  const PEBBLE_COUNT = 2000;
  const SHORE_COUNT = 4000;

  useEffect(() => {
    const classes: Array<{
      mesh: InstancedMesh | null;
      geom: BufferGeometry;
      count: number;
      scaleMin: number;
      scaleMax: number;
      offsetMin: number;
      offsetMax: number;
      sink: number;
      // Per-instance tint range — RGB multiplier, slight color variation.
      tints: Array<[number, number, number]>;
    }> = [
        {
          mesh: boulderRef.current,
          geom: boulderGeom,
          count: BOULDER_COUNT,
          scaleMin: 0.9,
          scaleMax: 1.8,
          offsetMin: 7.0,
          offsetMax: 12.0,
          sink: 0.45,
          tints: [
            [1.05, 1.0, 0.92], // warm gray
            [0.92, 0.95, 1.05], // cool gray
            [1.0, 0.92, 0.82], // sandstone
          ],
        },
        {
          mesh: midRockRef.current,
          geom: midRockGeom,
          count: MID_ROCK_COUNT,
          scaleMin: 0.35,
          scaleMax: 0.75,
          offsetMin: 5.8,
          offsetMax: 10.5,
          sink: 0.20,
          tints: [
            [1.0, 1.0, 1.0],
            [0.95, 0.92, 0.88],
            [0.88, 0.92, 1.0],
          ],
        },
        {
          mesh: pebbleRef.current,
          geom: pebbleGeom,
          count: PEBBLE_COUNT,
          scaleMin: 0.08,
          scaleMax: 0.22,
          offsetMin: 5.3,
          offsetMax: 9.5,
          sink: 0.06,
          tints: [
            [1.0, 0.98, 0.94],
            [0.85, 0.90, 1.05],
            [1.05, 0.95, 0.85],
            [0.95, 0.95, 0.95],
          ],
        },
        // Shore pebbles: very small, hugging the waterline (offset starts
        // INSIDE the river's nominal half-width so they interleave with
        // the edge — breaking the straight geometric boundary).
        {
          mesh: shoreRef.current,
          geom: shoreGeom,
          count: SHORE_COUNT,
          scaleMin: 0.04,
          scaleMax: 0.13,
          offsetMin: 4.6,
          offsetMax: 6.4,
          sink: 0.02,
          tints: [
            [1.0, 0.97, 0.92],
            [0.88, 0.92, 1.02],
            [1.04, 0.96, 0.86],
            [0.94, 0.94, 0.96],
            [0.82, 0.86, 0.92],
          ],
        },
      ];

    const m = new Matrix4();
    const pos = new Vector3();
    const q = new Quaternion();
    const e = new Euler();
    const scale = new Vector3();
    const tangent = new Vector3();
    const up = new Vector3(0, 1, 0);
    const side = new Vector3();
    const point = new Vector3();

    for (const cls of classes) {
      if (!cls.mesh) continue;
      const seeds = new Float32Array(cls.count);
      const tints = new Float32Array(cls.count * 3);
      for (let i = 0; i < cls.count; i++) {
        // Sample a position along the river curve, then offset perpendicular
        // to the flow on one of the two banks.
        const t = Math.random();
        riverCurve.getPoint(t, point);
        riverCurve.getTangent(t, tangent).normalize();
        side.crossVectors(tangent, up).normalize();
        const bankSign = Math.random() < 0.5 ? -1 : 1;
        const off = cls.offsetMin + Math.random() * (cls.offsetMax - cls.offsetMin);
        // Small jitter along the flow so rocks don't line up at sample t.
        const tJitter = (Math.random() - 0.5) * 2.5;
        const px = point.x + side.x * off * bankSign + tangent.x * tJitter;
        const pz = point.z + side.z * off * bankSign + tangent.z * tJitter;
        const s = cls.scaleMin + Math.random() * (cls.scaleMax - cls.scaleMin);
        // Slight non-uniform scale gives elongated rocks
        const sx = s * (0.85 + Math.random() * 0.4);
        const sy = s * (0.55 + Math.random() * 0.55);
        const sz = s * (0.85 + Math.random() * 0.4);
        pos.set(px, sy - cls.sink, pz);
        // Random orientation (full yaw, slight pitch/roll for natural tilt)
        const pitch = (Math.random() - 0.5) * 0.5;
        const yaw = Math.random() * Math.PI * 2;
        const roll = (Math.random() - 0.5) * 0.5;
        e.set(pitch, yaw, roll, 'YXZ');
        q.setFromEuler(e);
        scale.set(sx, sy, sz);
        m.compose(pos, q, scale);
        cls.mesh.setMatrixAt(i, m);
        seeds[i] = Math.random() * 10;
        const tint = cls.tints[Math.floor(Math.random() * cls.tints.length)];
        // Add per-instance brightness jitter on top of the picked tint.
        const k = 0.85 + Math.random() * 0.3;
        tints[i * 3 + 0] = tint[0] * k;
        tints[i * 3 + 1] = tint[1] * k;
        tints[i * 3 + 2] = tint[2] * k;
      }
      cls.mesh.count = cls.count;
      cls.mesh.instanceMatrix.needsUpdate = true;
      cls.geom.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
      cls.geom.setAttribute('aTint', new InstancedBufferAttribute(tints, 3));
    }
  }, [boulderGeom, midRockGeom, pebbleGeom, shoreGeom]);

  useFrame((state) => {
    const scroll = useAppStore.getState().scrollProgress;
    const vis = scroll >= RIVER_VISIBLE_FROM && scroll <= RIVER_VISIBLE_TO;
    if (groupRef.current) groupRef.current.visible = vis;
    if (!vis) return;

    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    rockMat.uniforms.uTime.value = state.clock.elapsedTime;
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
      {/* Wet-earth basin strip that follows the river curve. Significantly
          wider than the river so the dissolved edge & bank meander always
          have a darker substrate underneath — no gap to the surrounding
          forest ground. */}
      <mesh geometry={basinGeometry} frustumCulled={false} renderOrder={-1}>
        {/* Fixed ground color (same in every theme) so the basin always
            matches the surrounding forest floor and never changes hue
            with the mode.

            NOTE: no polygonOffset. It was added to lift the basin above the
            world ground plane, but polygonOffsetFactor is scaled by the
            polygon's depth slope — which blows up when the camera skims the
            basin at a grazing angle (the forest approach). That pushed the
            basin through the overlapping Valley terrain in patches and was
            the real source of the flickering "glitch" on the forest-side
            bank. Vertical separation (basin y=0.01, terrain min y≈0.05,
            ground y=-0.02) now keeps the depth ordering unambiguous from
            every angle, so the offset is unnecessary and harmful. */}
        <meshBasicMaterial color={BASIN_COLOR} toneMapped={false} fog />
      </mesh>
      <mesh geometry={geometry} material={material} frustumCulled={false} />
      {/* Riverbank rocks: boulders, mid rocks, pebbles */}
      <instancedMesh
        ref={boulderRef}
        args={[boulderGeom, rockMat, BOULDER_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={midRockRef}
        args={[midRockGeom, rockMat, MID_ROCK_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={pebbleRef}
        args={[pebbleGeom, rockMat, PEBBLE_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={shoreRef}
        args={[shoreGeom, rockMat, SHORE_COUNT]}
        frustumCulled={false}
      />
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
