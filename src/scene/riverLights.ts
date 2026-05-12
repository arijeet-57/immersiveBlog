import { CatmullRomCurve3, Vector3 } from 'three';

// Shared river-light geometry. The river curve is reproduced here (matching
// BiolumeRiver.tsx) so both the river renderer and the forest shader can
// reference the same lit points without circular imports.

const RIVER_Z = -25;
const RIVER_LENGTH_HALF = 80;

function buildRiverCurve(): CatmullRomCurve3 {
  const ctrl: Vector3[] = [];
  const N = 11;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = -RIVER_LENGTH_HALF + t * RIVER_LENGTH_HALF * 2;
    const z = RIVER_Z + Math.sin(t * Math.PI * 2.2) * 3.5 + Math.sin(t * Math.PI * 5.1) * 0.8;
    ctrl.push(new Vector3(x, 0, z));
  }
  return new CatmullRomCurve3(ctrl, false, 'centripetal', 0.5);
}

export const riverCurve = buildRiverCurve();

// 5 cyan riverbank lights, spaced along the curve, lifted just above the
// water surface so they cast onto the forest's near-side trunks.
const SAMPLE_TS = [0.12, 0.30, 0.50, 0.70, 0.88];
const LIGHT_Y = 1.4;

export const riverLightPositions: Vector3[] = SAMPLE_TS.map((t) => {
  const p = new Vector3();
  riverCurve.getPoint(t, p);
  p.y = LIGHT_Y;
  return p;
});

// Array of Vector3 — what Three.js expects for a vec3[] uniform binding.
export const riverLightUniformArray: Vector3[] = riverLightPositions.map(
  (p) => p.clone()
);

export const RIVER_LIGHT_COUNT = riverLightPositions.length;
export const RIVER_LIGHT_RANGE = 14.0;
export const RIVER_LIGHT_COLOR: [number, number, number] = [0.28, 0.78, 1.0];
