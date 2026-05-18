import { CatmullRomCurve3, Vector3 } from 'three';

// Scroll-driven journey:
//   0.00 → overhead, flower carpet fills the view
//   0.18 → arcing down forward
//   0.32 → ground POV in the flower field
//   0.45 → lifting forward toward the river bank
//   0.55 → crossing low over the silver river (river at z ≈ -25)
//   0.68 → entering the dark forest, near ground
//   0.78 → deep in the forest
//   0.84 → emerging from forest, climbing the ridge
//   0.88 → on top of the ridge — the valley reveals below
//   0.94 → descending into the moonlit valley
//   1.00 → camera lifts and tilts up; moon dominates the upper third
const positionWaypoints: Array<[number, [number, number, number]]> = [
  [0.0,  [0, 15,    0]],
  [0.18, [0,  6,    5]],
  [0.32, [0,  0.3,  0]],
  [0.45, [0,  4,  -12]],
  [0.50, [0, 10,  -20]],
  [0.52, [0, 14,  -25]],
  [0.56, [5, 10,  -35]],
  [0.60, [15, 3.6,-50]],
  [0.66, [-12,3.9,-85]],
  [0.72, [14, 4.3,-125]],
  [0.78, [-8, 5.0,-165]],
  [0.84, [0, 10.8, -200]],
  [0.88, [0, 25.65,-230]],
  [0.92, [0,  4.05,-280]],
  [0.96, [0,  2.03,-320]],
  [1.0,  [0, 45, -390]],
];

const lookAtWaypoints: Array<[number, [number, number, number]]> = [
  [0.0,  [0, 0,     0]],
  [0.18, [0, 1,     0]],
  [0.32, [0, 1.6,  -6]],
  [0.45, [0,  2,  -22]],
  [0.50, [0,  0,  -30]],
  [0.52, [0,  0,  -39]],
  [0.56, [8,  2,  -46]],
  [0.60, [8,  3,  -70]],
  [0.66, [-6, 3,  -105]],
  [0.72, [8, 4,   -145]],
  [0.78, [-4, 5,  -185]],
  [0.84, [0, 14, -250]],
  [0.88, [0,  0, -300]],
  [0.92, [0,  4, -330]],
  [0.96, [0, 20, -380]],
  [1.0,  [0, 88, -490]],
];

export const positionCurve = new CatmullRomCurve3(
  positionWaypoints.map(([, p]) => new Vector3(...p)),
  false,
  'centripetal',
  0.5
);

export const lookAtCurve = new CatmullRomCurve3(
  lookAtWaypoints.map(([, p]) => new Vector3(...p)),
  false,
  'centripetal',
  0.5
);

const anchors = positionWaypoints.map(
  ([s], i, arr) => [s, i / (arr.length - 1)] as const
);

export function scrollToCurveT(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  for (let i = 1; i < anchors.length; i++) {
    const [sPrev, tPrev] = anchors[i - 1];
    const [sNext, tNext] = anchors[i];
    if (p <= sNext) {
      const k = (p - sPrev) / (sNext - sPrev);
      return tPrev + k * (tNext - tPrev);
    }
  }
  return 1;
}

export function easePower2InOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
