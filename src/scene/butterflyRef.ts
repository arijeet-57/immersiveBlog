import { Vector3 } from 'three';

/** Shared mutable refs so ButterflyTrail can read the butterfly's
 *  world-space position every frame without Zustand writes. */
export const butterflyWorldPos = new Vector3();
export const butterflyVelocity = new Vector3();

/** Trail glow intensity (0 = off, 100 = full). Adjust to taste. */
export const TRAIL_INTENSITY = 100;

/** Whether the butterfly is currently visible (entrance fade ≥ a small
 *  threshold). Trail emission is gated on this so dust isn't spawned at the
 *  hidden off-screen fly-in position. Mutable object so reads/writes are
 *  zero-alloc and cross-module. */
export const butterflyVisibility = { value: 0 };
