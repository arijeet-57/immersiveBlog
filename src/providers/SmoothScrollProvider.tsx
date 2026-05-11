import { useEffect, type ReactNode } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollProgressRef } from '../hooks/useScrollProgress';

gsap.registerPlugin(ScrollTrigger);

export default function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      smoothWheel: true,
    });

    let lastLogged = -1;
    lenis.on('scroll', (e: { progress: number }) => {
      const progress = e.progress;
      scrollProgressRef.current = progress;
      ScrollTrigger.update();
      if (import.meta.env.DEV) {
        const step = Math.round(progress * 20);
        if (step !== lastLogged) {
          lastLogged = step;
          // eslint-disable-next-line no-console
          console.log(`scrollProgress: ${progress.toFixed(3)}`);
        }
      }
    });

    const tickerCb = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tickerCb);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tickerCb);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
