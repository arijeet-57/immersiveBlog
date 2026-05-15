import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/appStore';
import { butterflyWorldPos, butterflyVelocity } from './butterflyRef';

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

const CONFIGS: [number, BehaviorConfig][] = [
  [0.00, { forwardDist: 1.5, lateralAmp: 0.40, verticalAmp: 0.20, flapSpeed: 2.0, scaleMul: 1.00, glowBoost: 1.0, opacity: 1.0 }],
  [0.25, { forwardDist: 1.0, lateralAmp: 0.25, verticalAmp: 0.15, flapSpeed: 3.0, scaleMul: 0.95, glowBoost: 1.3, opacity: 1.0 }],
  [0.55, { forwardDist: 1.8, lateralAmp: 0.50, verticalAmp: 0.30, flapSpeed: 1.8, scaleMul: 1.05, glowBoost: 1.1, opacity: 1.0 }],
  [0.80, { forwardDist: 2.2, lateralAmp: 0.35, verticalAmp: 0.15, flapSpeed: 1.5, scaleMul: 1.15, glowBoost: 0.8, opacity: 1.0 }],
  [0.95, { forwardDist: 2.5, lateralAmp: 0.20, verticalAmp: 0.10, flapSpeed: 1.0, scaleMul: 1.20, glowBoost: 0.5, opacity: 0.3 }],
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

        // Organic flapping with wing-tip lag
        float localTime = uTime * uFlapSpeed - distFromPivot * 1.4;
        float flap = sin(localTime);

        // 3D curvature during flap
        float curve = pow(distFromPivot, 1.8) * 0.35 * flap;
        p.z += curve;

        // Trailing-edge flutter (high-freq, small amp)
        float flutter = sin(uTime * uFlapSpeed * 2.5 - distFromPivot * 3.0) * 0.02 * distFromPivot;
        p.z += flutter;

        // Flap rotation about body axis
        float angle = flap * 0.65 + 0.35;
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
    uniforms: { uTime: { value: 0 } },
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
      void main() {
        vec3 col = vec3(0.015, 0.045, 0.12);
        // Metallic fresnel sheen
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 4.0);
        col += vec3(0.06, 0.18, 0.40) * fresnel;
        // Bioluminescent dots along abdomen
        float segmentWave = sin(vLocalPos.y * 55.0 + uTime * 2.0) * 0.5 + 0.5;
        float dots = smoothstep(0.90, 0.97, segmentWave);
        float radial = smoothstep(0.045, 0.0, length(vLocalPos.xz));
        col += vec3(0.12, 0.55, 0.95) * dots * radial * 3.0;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    toneMapped: false,
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
  const localOffsetRef = useRef(new THREE.Vector3());
  const lAntennaRef = useRef<THREE.Group>(null);
  const rAntennaRef = useRef<THREE.Group>(null);

  // Idle-detection state
  const lastMouseRef  = useRef({ x: 0, y: 0 });
  const lastMoveTime  = useRef(0);
  const smoothScaleRef = useRef(scale);

  const rightWingGeo = useMemo(() => buildWingGeometry('right'), []);
  const leftWingGeo  = useMemo(() => buildWingGeometry('left'),  []);
  const wingMat      = useMemo(() => buildWingMaterial(), []);
  const bodyMat      = useMemo(() => buildBodyMaterial(), []);

  useFrame((state, dt) => {
    const time = state.clock.elapsedTime;
    const scroll = useAppStore.getState().scrollProgress;
    const cfg = lerpBehavior(scroll);

    // Update shader uniforms
    wingMat.uniforms.uTime.value = time;
    wingMat.uniforms.uFlapSpeed.value = cfg.flapSpeed;
    wingMat.uniforms.uGlowBoost.value = cfg.glowBoost;
    wingMat.uniforms.uOpacity.value = cfg.opacity;
    bodyMat.uniforms.uTime.value = time;

    // ── Animate antennae ──
    if (lAntennaRef.current) {
      lAntennaRef.current.rotation.z =  0.3 + Math.sin(time * 3.0 + 0.5) * 0.10;
      lAntennaRef.current.rotation.x =        Math.sin(time * 2.2)       * 0.06;
    }
    if (rAntennaRef.current) {
      rAntennaRef.current.rotation.z = -0.3 + Math.sin(time * 3.0 + 1.2) * 0.10;
      rAntennaRef.current.rotation.x =        Math.sin(time * 2.2 + 0.8) * 0.06;
    }

    if (interactive && groupRef.current) {
      const camera = state.camera;
      const mouseX = state.pointer.x;
      const mouseY = state.pointer.y;

      // ── Idle detection ──
      const mouseMoved =
        Math.abs(mouseX - lastMouseRef.current.x) > 0.002 ||
        Math.abs(mouseY - lastMouseRef.current.y) > 0.002;
      if (mouseMoved) {
        lastMouseRef.current.x = mouseX;
        lastMouseRef.current.y = mouseY;
        lastMoveTime.current = time;
      }
      const idleBlend = Math.min(1, Math.max(0, (time - lastMoveTime.current - 5) / 2));

      // ── Wandering motion (subtle, so it feels alive even when cursor is still) ──
      const wanderX = Math.sin(time * 0.8) * 0.06 + Math.cos(time * 1.3) * 0.04;
      const wanderY = Math.cos(time * 0.6) * 0.04 + Math.sin(time * 1.7) * 0.02;

      // ── Idle figure-8 ──
      const idleX = Math.sin(time * 0.5) * 0.35;
      const idleY = Math.sin(time * 1.0) * 0.15;

      // Calculate exact screen bounds at the butterfly's current depth
      const pCam = camera as THREE.PerspectiveCamera;
      const visibleHeightAtDepth = 2.0 * Math.tan((pCam.fov * Math.PI) / 360) * cfg.forwardDist;
      const visibleWidthAtDepth = visibleHeightAtDepth * state.viewport.aspect;

      // ── Target: follow cursor exactly (1:1 mapping) ──
      let targetX = (mouseX * visibleWidthAtDepth * 0.5) + wanderX;
      let targetY = (mouseY * visibleHeightAtDepth * 0.5) + wanderY;
      targetX = targetX * (1 - idleBlend) + idleX * idleBlend;
      targetY = targetY * (1 - idleBlend) + idleY * idleBlend;

      // ── Smooth lerp (ultra-fast snap for 1:1 responsiveness) ──
      const alpha = 1 - Math.exp(-50.0 * dt);
      const prevX = localOffsetRef.current.x;
      const prevY = localOffsetRef.current.y;
      localOffsetRef.current.x += (targetX - localOffsetRef.current.x) * alpha;
      localOffsetRef.current.y += (targetY - localOffsetRef.current.y) * alpha;

      const curX = localOffsetRef.current.x;
      const curY = localOffsetRef.current.y;

      // Velocity in screen-space for orientation
      const velX = curX - prevX;
      const velY = curY - prevY;

      // ── World position (zero-alloc) ──
      _prevPos.copy(butterflyWorldPos);
      _forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      _up.set(0, 1, 0).applyQuaternion(camera.quaternion);

      _finalPos.copy(camera.position)
        .addScaledVector(_forward, cfg.forwardDist)
        .addScaledVector(_right, curX)
        .addScaledVector(_up, curY);

      groupRef.current.position.copy(_finalPos);

      // Publish to shared ref for trail
      butterflyWorldPos.copy(_finalPos);
      butterflyVelocity.copy(_finalPos).sub(_prevPos);

      // ── Velocity-based orientation ──
      // Heading: yaw toward movement direction
      const speed = Math.sqrt(velX * velX + velY * velY);
      const headingAngle = speed > 0.0001
        ? Math.atan2(-velX, 0.1) // yaw toward horizontal movement
        : 0;
      // Bank: roll into turns based on lateral velocity
      const bankAngle = -velX * 25.0;
      // Pitch: tilt based on vertical velocity
      const pitchAngle = velY * 15.0;

      _targetQuat.copy(camera.quaternion);
      _diagonalEuler.set(
        0.3 + pitchAngle,    // pitch — nose up/down with vertical motion
        headingAngle,         // yaw — face movement direction
        bankAngle,            // roll — bank into turns
        'YXZ',
      );
      _diagonalQuat.setFromEuler(_diagonalEuler);
      _targetQuat.multiply(_diagonalQuat);
      groupRef.current.quaternion.slerp(_targetQuat, alpha);

      // ── Smooth scale transition ──
      const targetScale = scale * cfg.scaleMul;
      smoothScaleRef.current += (targetScale - smoothScaleRef.current) * alpha;
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
