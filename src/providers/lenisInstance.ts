import type Lenis from 'lenis';

let instance: Lenis | null = null;

export function setLenis(l: Lenis | null) {
  instance = l;
}

export function getLenis(): Lenis | null {
  return instance;
}

/** Scroll to a normalized progress value [0, 1]. */
export function scrollToProgress(p: number, opts?: { immediate?: boolean }) {
  const lenis = instance;
  if (!lenis) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const target = Math.max(0, Math.min(1, p)) * max;
  lenis.scrollTo(target, { immediate: opts?.immediate ?? false });
}
