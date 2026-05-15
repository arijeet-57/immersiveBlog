import { Vector3 } from 'three';

/** Shared mutable refs so ButterflyTrail can read the butterfly's
 *  world-space position every frame without Zustand writes. */
export const butterflyWorldPos = new Vector3();
export const butterflyVelocity = new Vector3();

/** Trail glow intensity (0 = off, 100 = full). Adjust to taste. */
export const TRAIL_INTENSITY = 100;
