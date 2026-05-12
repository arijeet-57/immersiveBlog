import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';

// "Seed of Light" loader — full-screen black with a single cyan point
// breathing at ~0.6Hz. The scene is fully procedural (shaders + drei Stars)
// so Three.js's DefaultLoadingManager never registers any items, which
// means useProgress().progress stays at 0 forever. We instead poll for the
// manager being idle (active === false) with progress in a "done" state
// (100 = loaded everything, 0 = nothing to load), gated by a minimum
// display time so the seed gets at least one breathe cycle on screen.

const MIN_SHOW_MS = 600;
const FADE_MS = 820;

export default function Loader() {
  const [phase, setPhase] = useState<'loading' | 'fading' | 'done'>('loading');

  useEffect(() => {
    if (phase !== 'loading') return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const { active, progress } = useProgress.getState();
      const enoughTime = performance.now() - start >= MIN_SHOW_MS;
      const assetsIdle = !active && (progress === 0 || progress >= 100);
      if (enoughTime && assetsIdle) {
        // Give the camera 2 more rAFs to apply its cold-load scroll target
        // before fading, so deep-link refreshes don't flash the intro scene.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setPhase('fading'))
        );
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'fading') return;
    const t = window.setTimeout(() => setPhase('done'), FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 100,
        display: 'grid',
        placeItems: 'center',
        opacity: phase === 'fading' ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        pointerEvents: phase === 'fading' ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: '999px',
          background:
            'radial-gradient(circle, rgba(180,220,255,1) 0%, rgba(80,160,255,0.92) 35%, rgba(40,100,200,0) 75%)',
          boxShadow:
            '0 0 30px 6px rgba(110, 180, 255, 0.65), 0 0 80px 20px rgba(70, 140, 230, 0.32)',
          animation: 'seed-breathe 1.66s ease-in-out infinite',
        }}
      />
    </div>
  );
}
