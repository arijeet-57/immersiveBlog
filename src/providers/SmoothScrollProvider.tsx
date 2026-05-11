import { useEffect, useRef, type ReactNode } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAppStore } from '../store/appStore';

gsap.registerPlugin(ScrollTrigger);

export default function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const isLocked = useAppStore((s) => s.isLocked);

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
    lenisRef.current = lenis;

    const setScrollProgress = useAppStore.getState().setScrollProgress;
    let lastLogged = -1;
    lenis.on('scroll', (e: { progress: number }) => {
      setScrollProgress(e.progress);
      ScrollTrigger.update();
      if (import.meta.env.DEV) {
        const step = Math.round(e.progress * 20);
        if (step !== lastLogged) {
          lastLogged = step;
          // eslint-disable-next-line no-console
          console.log(`scrollProgress: ${e.progress.toFixed(3)}`);
        }
      }
    });

    const tickerCb = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tickerCb);
    gsap.ticker.lagSmoothing(0);

    if (useAppStore.getState().isLocked) lenis.stop();

    return () => {
      gsap.ticker.remove(tickerCb);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    if (isLocked) lenis.stop();
    else lenis.start();
  }, [isLocked]);

  return <>{children}</>;
}
