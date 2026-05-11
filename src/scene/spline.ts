import { CatmullRomCurve3, Vector3 } from 'three';

const positionWaypoints: Array<[number, [number, number, number]]> = [
  [0.0, [0, 80, 0]],
  [0.35, [0, 25, 20]],
  [0.5, [0, 1.6, 6]],
  [0.65, [0, 12, -10]],
  [1.0, [0, 30, -120]],
];

const lookAtWaypoints: Array<[number, [number, number, number]]> = [
  [0.0, [0, 0, 0]],
  [0.35, [0, 1, 0]],
  [0.5, [0, 1.2, 0]],
  [0.65, [0, 2, -30]],
  [1.0, [0, 5, -300]],
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
