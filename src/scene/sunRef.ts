import { Mesh } from 'three';

// Shared mutable ref slot so the Environment's moon mesh can be used as
// the GodRays light source in PostFX without rendering a duplicate sphere.
// Subscribers are notified once when the moon mounts.
type Listener = (mesh: Mesh) => void;

let current: Mesh | null = null;
const listeners = new Set<Listener>();

export function setSunMesh(mesh: Mesh | null) {
  current = mesh;
  if (mesh) {
    for (const fn of listeners) fn(mesh);
  }
}

export function subscribeSun(fn: Listener): () => void {
  if (current) fn(current);
  listeners.add(fn);
  return () => listeners.delete(fn);
}
