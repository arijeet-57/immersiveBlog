import { useEffect, useRef, type CSSProperties } from 'react';
import { useAppStore } from '../store/appStore';
import { scrollToProgress } from '../providers/lenisInstance';

const wrap: CSSProperties = {
  position: 'fixed',
  top: 24,
  right: 24,
  zIndex: 20,
  width: 4,
  height: 180,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.10)',
  overflow: 'hidden',
  pointerEvents: 'auto',
  cursor: 'pointer',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
};

const fill: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '0%',
  background:
    'linear-gradient(to bottom, rgba(180,220,255,0.95), rgba(80,140,255,0.75))',
  boxShadow: '0 0 14px rgba(120,180,255,0.55)',
  willChange: 'height',
};

export default function ScrollProgress() {
  const fillRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    el.style.height = `${useAppStore.getState().scrollProgress * 100}%`;
    return useAppStore.subscribe(
      (s) => s.scrollProgress,
      (v) => {
        el.style.height = `${v * 100}%`;
      }
    );
  }, []);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = (e.clientY - rect.top) / rect.height;
    scrollToProgress(p);
  }

  return (
    <div ref={wrapRef} style={wrap} onClick={handleClick} aria-label="Scroll progress">
      <div ref={fillRef} style={fill} />
    </div>
  );
}
