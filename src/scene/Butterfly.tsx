import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/appStore';
import { butterflyWorldPos, butterflyVelocity, butterflyVisibility } from './butterflyRef';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Module-level temp objects — zero per-frame allocations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const _forward = new THREE.Vector3();
const _right   = new THREE.Vector3();
const _up      = new THREE.Vector3();
const _finalPos = new THREE.Vector3();
const _prevPos  = new THREE.Vector3();
const _targetQuat   = new THREE.Quaternion();
const _diagonalQuat = new THREE.Quaternion();
const _diagonalEuler = new THREE.Euler();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Scroll-aware behavior configs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface BehaviorConfig {
  forwardDist: number;
  lateralAmp: number;
  verticalAmp: number;
  flapSpeed: number;
  scaleMul: number;
  glowBoost: number;
  opacity: number;
}

// Flap speed is intentionally a constant across all stages — modulating it
// with scroll progress made the wings appear to "speed up" during scroll
// transitions. The calm idle rate (4.0) is what reads correctly on the home
// page, so we keep that throughout.
const FLAP_SPEED_CONSTANT = 12.0;

const CONFIGS: [number, BehaviorConfig][] = [
  [0.00, { forwardDist: 1.5, lateralAmp: 0.85, verticalAmp: 0.45, flapSpeed: FLAP_SPEED_CONSTANT, scaleMul: 1.15, glowBoost: 1.0, opacity: 1.0 }],
  [0.25, { forwardDist: 1.0, lateralAmp: 0.70, verticalAmp: 0.40, flapSpeed: FLAP_SPEED_CONSTANT, scaleMul: 1.10, glowBoost: 1.3, opacity: 1.0 }],
  [0.55, { forwardDist: 1.8, lateralAmp: 0.95, verticalAmp: 0.55, flapSpeed: FLAP_SPEED_CONSTANT, scaleMul: 1.20, glowBoost: 1.1, opacity: 1.0 }],
  [0.80, { forwardDist: 2.2, lateralAmp: 0.80, verticalAmp: 0.40, flapSpeed: FLAP_SPEED_CONSTANT, scaleMul: 1.30, glowBoost: 0.8, opacity: 1.0 }],
  [0.95, { forwardDist: 2.5, lateralAmp: 0.60, verticalAmp: 0.30, flapSpeed: FLAP_SPEED_CONSTANT, scaleMul: 1.35, glowBoost: 0.5, opacity: 0.3 }],
];

const _cfg: BehaviorConfig = { ...CONFIGS[0][1] };

function lerpBehavior(scroll: number): BehaviorConfig {
  for (let i = 1; i < CONFIGS.length; i++) {
    if (scroll <= CONFIGS[i][0]) {
      const [sA, a] = CONFIGS[i - 1];
      const [sB, b] = CONFIGS[i];
      const t = (scroll - sA) / (sB - sA);
      _cfg.forwardDist  = a.forwardDist  + (b.forwardDist  - a.forwardDist)  * t;
      _cfg.lateralAmp   = a.lateralAmp   + (b.lateralAmp   - a.lateralAmp)  * t;
      _cfg.verticalAmp  = a.verticalAmp  + (b.verticalAmp  - a.verticalAmp) * t;
      _cfg.flapSpeed    = a.flapSpeed    + (b.flapSpeed    - a.flapSpeed)    * t;
      _cfg.scaleMul     = a.scaleMul     + (b.scaleMul     - a.scaleMul)    * t;
      _cfg.glowBoost    = a.glowBoost    + (b.glowBoost    - a.glowBoost)   * t;
      _cfg.opacity      = a.opacity      + (b.opacity      - a.opacity)     * t;
      return _cfg;
    }
  }
  const last = CONFIGS[CONFIGS.length - 1][1];
  Object.assign(_cfg, last);
  return _cfg;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Wing geometry — gossamer-thin swallowtail with UV for veins
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildWingGeometry(side: 'left' | 'right'): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  // Forewing — large, rounded
  shape.bezierCurveTo(0.08, 0.40, 0.38, 0.92, 0.92, 0.80);
  shape.bezierCurveTo(1.10, 0.58, 0.95, 0.28, 0.80, 0.08);
  // Hindwing — with swallowtail
  shape.bezierCurveTo(0.90, -0.02, 0.92, -0.22, 0.86, -0.42);
  shape.bezierCurveTo(0.96, -0.72, 0.82, -0.92, 0.76, -1.12);
  shape.bezierCurveTo(0.66, -0.90, 0.60, -0.70, 0.50, -0.60);
  shape.bezierCurveTo(0.20, -0.72, 0.10, -0.40, 0, -0.30);
  shape.bezierCurveTo(-0.05, -0.10, 0, 0, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: 0.008,         // gossamer thin
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 1,
  });

  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const pos = geo.attributes.position;
  const uvs   = new Float32Array(pos.count * 2);
  const sides = new Float32Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    uvs[i * 2]     = (x - bb.min.x) / (bb.max.x - bb.min.x);
    uvs[i * 2 + 1] = (y - bb.min.y) / (bb.max.y - bb.min.y);
    sides[i] = side === 'left' ? -1.0 : 1.0;
    if (side === 'left') pos.setX(i, -x);
  }

  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aSide', new THREE.BufferAttribute(sides, 1));
  geo.computeVertexNormals();
  return geo;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Wing shader — veins, iridescence, edge transparency, emissive
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildWingMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uFlapSpeed: { value: 12.0 },
      uGlowBoost: { value: 1.0 },
      uOpacity:   { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSide;
      varying vec2  vUv;
      varying vec3  vNormal;
      varying vec3  vViewDir;
      varying float vEdgeFade;
      uniform float uTime;
      uniform float uFlapSpeed;

      void main() {
        vUv = uv;
        vec3 p = position;

        float pivotX = 0.05 * aSide;
        float dx = p.x - pivotX;
        float distFromPivot = abs(dx);

        // ── Asymmetric flap waveform ──
        // Real butterflies have a fast power downstroke and slower recovery
        // upstroke. We bias a sine through a power curve and add a 2nd
        // harmonic to flatten the top (mid-air pause) and steepen the bottom.
        float localTime = uTime * uFlapSpeed - distFromPivot * 1.6;
        float s1 = sin(localTime);
        float s2 = sin(localTime * 2.0 + 0.4);
        // Skew so down portion is steeper, top dwells slightly
        float flap = s1 * 0.85 + s2 * 0.18;
        // Soft clamp prevents the harmonics from over-extending the wing tip
        flap = clamp(flap, -1.0, 1.0);

        // 3D curvature during flap — wing cups downward on power stroke,
        // flattens on recovery (more flex on the downstroke).
        float cupSign = step(0.0, -flap);                 // 1 on downstroke
        float curve = pow(distFromPivot, 1.7)
                    * (0.30 + 0.20 * cupSign) * flap;
        p.z += curve;

        // ── Span-wise twist ──
        // Tips lead the root through the stroke — a subtle twist along the
        // wing span gives the wing a flexible, paper-like feel.
        float twist = flap * 0.55 * pow(distFromPivot, 1.2);
        float ty = uv.y - 0.5;             // distance from chord midline
        p.z += ty * twist * 0.6;

        // Trailing-edge flutter (high-freq, small amp)
        float flutter = sin(uTime * uFlapSpeed * 2.5 - distFromPivot * 3.2) * 0.022 * distFromPivot;
        p.z += flutter;

        // ── Flap rotation about body axis ──
        // Asymmetric dihedral: stays slightly raised at rest (+0.30 bias),
        // dips lower on downstroke than it raises on upstroke.
        float angle = flap * 0.75 + 0.30;
        float c = cos(angle * aSide);
        float s = sin(angle * aSide);
        if (abs(p.x) > abs(pivotX)) {
          float rx = dx * c - p.z * s;
          float rz = dx * s + p.z * c;
          p.x = pivotX + rx;
          p.z = rz;
        }

        // Edge fade: wings become translucent near tips
        vEdgeFade = 1.0 - smoothstep(0.65, 1.0, uv.x) * 0.55;

        vec4 worldPos = modelMatrix * vec4(p, 1.0);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        vNormal  = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2  vUv;
      varying vec3  vNormal;
      varying vec3  vViewDir;
      varying float vEdgeFade;
      uniform float uGlowBoost;
      uniform float uOpacity;

      // ── helpers ──
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1,0)), f.x),
          mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }
      float sdSegment(vec2 p, vec2 a, vec2 b) {
        vec2 pa = p - a, ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return length(pa - ba * h);
      }

      void main() {
        // ── Base color: deep royal blue with Fresnel iridescence ──
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
        vec3 col = mix(vec3(0.04, 0.12, 0.50), vec3(0.12, 0.35, 0.90), fresnel);

        // ── Branching vein network ──
        // Wing root is at UV ≈ (0, 0.55). Main veins radiate outward.
        vec2 root = vec2(0.0, 0.55);
        float d = 1.0;
        // Costa (leading edge)
        d = min(d, sdSegment(vUv, root, vec2(0.95, 0.88)));
        // Subcosta
        d = min(d, sdSegment(vUv, root, vec2(0.92, 0.72)));
        // Radius
        d = min(d, sdSegment(vUv, root, vec2(0.88, 0.55)));
        // Media
        d = min(d, sdSegment(vUv, root, vec2(0.82, 0.38)));
        // Cubitus
        d = min(d, sdSegment(vUv, root, vec2(0.72, 0.18)));
        // Anal vein
        d = min(d, sdSegment(vUv, root, vec2(0.60, 0.05)));
        // Cross-veins
        d = min(d, sdSegment(vUv, vec2(0.35, 0.72), vec2(0.45, 0.60)));
        d = min(d, sdSegment(vUv, vec2(0.50, 0.80), vec2(0.60, 0.65)));
        d = min(d, sdSegment(vUv, vec2(0.55, 0.55), vec2(0.68, 0.40)));
        d = min(d, sdSegment(vUv, vec2(0.40, 0.45), vec2(0.55, 0.30)));

        float veinMask = smoothstep(0.018, 0.004, d);
        col = mix(col, vec3(0.30, 0.70, 1.0), veinMask * 0.65);

        // ── Bright cyan core near body ──
        float bodyDist = length(vUv - root);
        float core = smoothstep(0.35, 0.0, bodyDist);
        col = mix(col, vec3(0.18, 0.55, 0.95), core * 0.5);

        // ── Stardust sparkle near edges ──
        float spots = noise(vUv * 50.0);
        float edgeMask = smoothstep(0.5, 0.95, vUv.x);
        float star = smoothstep(0.80, 0.84, spots) * edgeMask;
        col += vec3(0.6, 0.85, 1.0) * star * 3.5;

        // ── Subtle dark border at wing outline ──
        col *= mix(1.0, 0.35, smoothstep(0.88, 1.0, vUv.x));

        // ── Emissive boost — feeds into Bloom post-fx ──
        float emissive = mix(2.2, 1.4, smoothstep(0.0, 0.8, vUv.x));
        col *= emissive * uGlowBoost;

        // ── Final alpha: edge transparency ──
        float alpha = vEdgeFade * uOpacity;

        gl_FragColor = vec4(col, alpha);
      }
    `,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Body shader — dark blue-black with bioluminescent segment dots
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildBodyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1.0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        vNormal = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;
      uniform float uTime;
      uniform float uOpacity;
      void main() {
        // Nearly pure black body — only a whisper of midnight blue.
        vec3 col = vec3(0.0008, 0.0015, 0.004);
        // Very faint deep-blue rim — keeps silhouette readable, no shine
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 5.5);
        col += vec3(0.010, 0.022, 0.055) * fresnel;
        // Bioluminescent dots along abdomen — kept bright for contrast
        float segmentWave = sin(vLocalPos.y * 55.0 + uTime * 2.0) * 0.5 + 0.5;
        float dots = smoothstep(0.90, 0.97, segmentWave);
        float radial = smoothstep(0.045, 0.0, length(vLocalPos.xz));
        col += vec3(0.12, 0.55, 0.95) * dots * radial * 3.0;
        gl_FragColor = vec4(col, uOpacity);
      }
    `,
    toneMapped: false,
    transparent: true,
    // Body parts (thorax, abdomen segments, head) overlap — with depthWrite
    // off they z-fight and render out of order, causing the glitch. The body
    // is effectively opaque (uOpacity = 1 except during the brief entrance
    // fade), so writing depth here is safe and necessary.
    depthWrite: true,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
type ButterflyProps = {
  position?: [number, number, number];
  scale?: number;
  interactive?: boolean;
  flapSpeed?: number;
};

export default function Butterfly({
  position = [0, 0, 0],
  scale = 1,
  interactive = false,
  flapSpeed = 12.0,
}: ButterflyProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetOffsetRef = useRef(new THREE.Vector3());
  const localOffsetRef = useRef(new THREE.Vector3());
  const lAntennaRef = useRef<THREE.Group>(null);
  const rAntennaRef = useRef<THREE.Group>(null);
  const smoothScaleRef = useRef(scale);

  const rightWingGeo = useMemo(() => buildWingGeometry('right'), []);
  const leftWingGeo  = useMemo(() => buildWingGeometry('left'),  []);
  const wingMat      = useMemo(() => buildWingMaterial(), []);
  const bodyMat      = useMemo(() => buildBodyMaterial(), []);

  useFrame((state, dt) => {
    const time = state.clock.elapsedTime;
    const scroll = useAppStore.getState().scrollProgress;
    const cfg = lerpBehavior(scroll);

    // ── Entrance fade ──
    // Hidden on the home page (scroll ≈ 0); fades + flies in as the user
    // begins scrolling. Fully present by scroll = 0.06.
    const entrance = THREE.MathUtils.smoothstep(scroll, 0.005, 0.06);

    if (groupRef.current) {
      groupRef.current.visible = entrance > 0.001;
    }
    butterflyVisibility.value = entrance;

    // Update shader uniforms
    wingMat.uniforms.uTime.value = time;
    wingMat.uniforms.uFlapSpeed.value = cfg.flapSpeed;
    wingMat.uniforms.uGlowBoost.value = cfg.glowBoost;
    wingMat.uniforms.uOpacity.value = cfg.opacity * entrance;
    bodyMat.uniforms.uTime.value = time;
    bodyMat.uniforms.uOpacity.value = entrance;

    // ── Animate antennae ──
    // Antennae lag a bit behind body motion — driven by wingbeat phase plus
    // their own slower sway, with a slight side-to-side asymmetry.
    const wingPhase = time * cfg.flapSpeed;
    const flapEnv   = Math.sin(wingPhase);
    if (lAntennaRef.current) {
      lAntennaRef.current.rotation.z =  0.30 + Math.sin(time * 3.0 + 0.5) * 0.10 + flapEnv * 0.04;
      lAntennaRef.current.rotation.x =         Math.sin(time * 2.2)       * 0.07 - flapEnv * 0.05;
    }
    if (rAntennaRef.current) {
      rAntennaRef.current.rotation.z = -0.30 + Math.sin(time * 3.0 + 1.2) * 0.10 - flapEnv * 0.04;
      rAntennaRef.current.rotation.x =         Math.sin(time * 2.2 + 0.8) * 0.07 - flapEnv * 0.05;
    }

    if (interactive && groupRef.current) {
      const camera = state.camera;

      // Calculate exact screen bounds at the butterfly's current depth
      const pCam = camera as THREE.PerspectiveCamera;
      const visibleHeightAtDepth = 2.0 * Math.tan((pCam.fov * Math.PI) / 360) * cfg.forwardDist;
      const visibleWidthAtDepth = visibleHeightAtDepth * state.viewport.aspect;

      // ── Autonomous flight path: 3-axis lissajous with detuned harmonics ──
      // Detuned (irrational-ratio) frequencies prevent the path from repeating.
      // Per-axis "emphasis" envelopes rotate which axis dominates over ~20s
      // cycles so the motion has changing character — lateral now, then
      // mostly vertical, then a deep dive — rather than a constant blur.
      const empX = 0.55 + 0.45 * Math.sin(time * 0.11);
      const empY = 0.55 + 0.45 * Math.sin(time * 0.13 + 2.1);
      const empZ = 0.55 + 0.45 * Math.sin(time * 0.09 + 4.2);

      // Layer 4 detuned sinusoids per axis — including a very slow large-amp
      // term that wanders the butterfly to far-left / far-right of the screen
      // over ~20s, plus a faster jittery component for "random" micro-motion.
      const pathX = (
        Math.sin(time * 0.19 + 0.4) * 0.90 +   // slow wide sweep — drags it edge to edge
        Math.sin(time * 0.61) * 0.55 +
        Math.sin(time * 1.43 + 1.1) * 0.35 +
        Math.sin(time * 2.71 + 2.3) * 0.22 +   // jittery flutter
        Math.sin(time * 3.97 + 0.8) * 0.12
      ) * empX;
      const pathY = (
        Math.cos(time * 0.23 + 1.7) * 0.70 +   // slow vertical sweep
        Math.cos(time * 0.83) * 0.50 +
        Math.sin(time * 1.97 + 0.7) * 0.35 +
        Math.cos(time * 0.31 + 1.8) * 0.22 +
        Math.sin(time * 3.41 + 2.6) * 0.10     // jittery flutter
      ) * empY;

      // ── Depth excursion ──
      // Slow swing periodically pulls the butterfly toward the camera, then
      // pushes it back; tight bounds keep it from ever feeling distant.
      const slowZ = Math.sin(time * 0.21 + 1.3);                 // -1 .. 1
      const dipZ  = Math.pow(Math.max(0, slowZ), 2.0);            // dive toward camera
      const farZ  = Math.pow(Math.max(0, -slowZ), 1.4);           // gentle pull back
      const pathZ = (
        -dipZ * 1.0          // near-camera dive (negative = toward viewer)
        + farZ * 0.55        // far retreat — capped tight so it never feels distant
        + Math.sin(time * 0.47 + 0.9) * 0.20
        + Math.cos(time * 1.13 + 2.1) * 0.10
      ) * empZ;

      // Soft-saturate path values to ±1 so motion stays inside the screen
      // bounds at this depth no matter how high the lissajous peaks get.
      const satX = Math.tanh(pathX * 0.7);
      const satY = Math.tanh(pathY * 0.7);
      // Leave a 10% margin from the frustum edges so the wings never clip out.
      const halfW = visibleWidthAtDepth * 0.45;
      const halfH = visibleHeightAtDepth * 0.45;
      const rawTargetX = satX * cfg.lateralAmp * halfW;
      const rawTargetY = satY * cfg.verticalAmp * halfH;
      // Depth offset, scaled by base forwardDist. Capped so it never recedes
      // beyond ~1.6× base distance — keeps the butterfly always feeling near.
      const rawTargetZ = THREE.MathUtils.clamp(
        pathZ * cfg.forwardDist,
        -cfg.forwardDist * 0.65,   // can come ~35% of forward dist toward camera
         cfg.forwardDist * 0.6,    // can recede ~60% of forward dist back
      );

      // ── Smooth position & calculate jitter-free velocity ──
      const lambdaPos = 3.0; // Lower lambda = heavier, smoother feel
      const posAlpha = 1 - Math.exp(-lambdaPos * dt);
      const rotAlpha = 1 - Math.exp(-4.0 * dt); // Very smooth rotation slerp

      const prevX = localOffsetRef.current.x;
      const prevY = localOffsetRef.current.y;
      const prevZ = localOffsetRef.current.z;

      // Directly smooth towards the mathematical path
      localOffsetRef.current.x += (rawTargetX - prevX) * posAlpha;
      localOffsetRef.current.y += (rawTargetY - prevY) * posAlpha;
      localOffsetRef.current.z += (rawTargetZ - prevZ) * posAlpha;

      const curX = localOffsetRef.current.x;
      const curY = localOffsetRef.current.y;
      const curZ = localOffsetRef.current.z;

      // Velocity via mathematical derivative — frame-rate independent
      const velX = (rawTargetX - prevX) * lambdaPos;
      const velY = (rawTargetY - prevY) * lambdaPos;
      const velZ = (rawTargetZ - prevZ) * lambdaPos;

      // ── World position (zero-alloc) ──
      _prevPos.copy(butterflyWorldPos);
      _forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      _up.set(0, 1, 0).applyQuaternion(camera.quaternion);

      // curZ is negative when diving toward camera. Clamp the effective
      // forward distance to a minimum so the butterfly never crosses the
      // near-plane or passes behind the viewer.
      const effForward = Math.max(0.35, cfg.forwardDist + curZ);

      // Fly-in offset: while `entrance` ramps from 0 → 1, displace the
      // butterfly off-screen down-right and farther back, so it visibly
      // swoops into frame instead of popping in.
      const flyIn = 1.0 - entrance;
      const flyInRight = flyIn * visibleWidthAtDepth * 0.9;
      const flyInDown  = flyIn * visibleHeightAtDepth * 0.7;
      const flyInBack  = flyIn * cfg.forwardDist * 0.8;

      // ── Wingbeat-synced body bob ──
      // Body rises during downstroke (negative flapEnv), settles during the
      // upstroke. Tiny amplitude — reads as life, not as bouncing.
      const bob = -flapEnv * 0.012 * smoothScaleRef.current / scale;

      _finalPos.copy(camera.position)
        .addScaledVector(_forward, effForward + flyInBack)
        .addScaledVector(_right, curX + flyInRight)
        .addScaledVector(_up, curY - flyInDown + bob);

      groupRef.current.position.copy(_finalPos);

      butterflyWorldPos.copy(_finalPos);
      butterflyVelocity.copy(_finalPos).sub(_prevPos);

      // ── Multi-axis orientation: velocity-derived + surreal idle tumble ──
      // Heading: yaw toward movement direction
      const headingAngle = Math.atan2(-velX, 6.0);
      // Bank: roll into lateral turns, plus a slow continuous tumble so the
      // butterfly is never aligned to a single plane (the "surreal" feel).
      const idleRoll = Math.sin(time * 0.37) * 0.35 + Math.sin(time * 0.91 + 1.4) * 0.15;
      const bankAngle = THREE.MathUtils.clamp(-velX * 0.15 + idleRoll, -1.4, 1.4);
      // Pitch: tilt with vertical motion, plus depth-velocity (dives forward
      // when moving toward camera) and a slow nodding wobble.
      const idlePitch = Math.sin(time * 0.53 + 0.6) * 0.18;
      const pitchAngle = THREE.MathUtils.clamp(
        velY * 0.15 - velZ * 0.18 + idlePitch,
        -1.0,
        1.0,
      );
      // Yaw: heading plus a slow side-to-side head sway
      const idleYaw = Math.sin(time * 0.43 + 2.2) * 0.22;

      _targetQuat.copy(camera.quaternion);
      _diagonalEuler.set(
        0.3 + pitchAngle,
        headingAngle + idleYaw,
        bankAngle,
        'YXZ',
      );
      _diagonalQuat.setFromEuler(_diagonalEuler);
      _targetQuat.multiply(_diagonalQuat);
      groupRef.current.quaternion.slerp(_targetQuat, rotAlpha);

      // ── Smooth scale transition ──
      const targetScale = scale * cfg.scaleMul;
      smoothScaleRef.current += (targetScale - smoothScaleRef.current) * posAlpha;
      const s = smoothScaleRef.current;
      groupRef.current.scale.set(s, s, s);

    } else if (groupRef.current) {
      // Static placement — gentle bobbing
      groupRef.current.position.y = position[1] + Math.sin(time * 2.5) * 0.1;
    }
  });

  // ── Abdomen segments: 5 tapering spheres ──
  const abdomenSegments = useMemo(() => {
    const segs: { y: number; r: number }[] = [];
    for (let i = 0; i < 5; i++) {
      segs.push({ y: -0.02 - i * 0.065, r: 0.044 - i * 0.006 });
    }
    return segs;
  }, []);

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* ── Wings ── */}
      <mesh geometry={rightWingGeo} material={wingMat} />
      <mesh geometry={leftWingGeo}  material={wingMat} />

      {/* ── Thorax ── */}
      <mesh position={[0, 0.04, 0]} material={bodyMat}>
        <sphereGeometry args={[0.05, 8, 6]} />
      </mesh>

      {/* ── Segmented abdomen ── */}
      {abdomenSegments.map((seg, i) => (
        <mesh key={i} position={[0, seg.y, 0]} material={bodyMat}>
          <sphereGeometry args={[seg.r, 8, 6]} />
        </mesh>
      ))}

      {/* ── Head ── */}
      <mesh position={[0, 0.14, 0]} material={bodyMat}>
        <sphereGeometry args={[0.048, 8, 8]} />
      </mesh>

      {/* ── Left Antenna (animated group) ── */}
      <group ref={lAntennaRef} position={[-0.02, 0.16, 0]}>
        <mesh material={bodyMat}>
          <cylinderGeometry args={[0.004, 0.004, 0.18]} />
        </mesh>
        {/* Club tip */}
        <mesh position={[- 0.03, 0.10, 0]} material={bodyMat}>
          <sphereGeometry args={[0.012, 4, 4]} />
        </mesh>
      </group>

      {/* ── Right Antenna (animated group) ── */}
      <group ref={rAntennaRef} position={[0.02, 0.16, 0]}>
        <mesh material={bodyMat}>
          <cylinderGeometry args={[0.004, 0.004, 0.18]} />
        </mesh>
        <mesh position={[0.03, 0.10, 0]} material={bodyMat}>
          <sphereGeometry args={[0.012, 4, 4]} />
        </mesh>
      </group>
    </group>
  );
}
