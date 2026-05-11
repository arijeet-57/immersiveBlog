import { useEffect, useRef, type ReactNode } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { useAppStore } from '../store/appStore';
import { setLenis } from './lenisInstance';

export default function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.6,
      smoothWheel: true,
      // Heavier wheel-to-scroll ratio so a single notch advances less of
      // the page. Combined with the longer page spacer, panels get more
      // dwell time on screen.
      wheelMultiplier: 0.7,
      touchMultiplier: 0.8,
    });
    lenisRef.current = lenis;
    setLenis(lenis);

    const setScrollProgress = useAppStore.getState().setScrollProgress;
    lenis.on('scroll', (e: { progress: number }) => {
      setScrollProgress(e.progress);
    });

    const tickerCb = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tickerCb);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tickerCb);
      lenis.destroy();
      lenisRef.current = null;
      setLenis(null);
    };
  }, []);

  return <>{children}</>;
}
