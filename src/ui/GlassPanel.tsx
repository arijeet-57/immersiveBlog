import type { CSSProperties, ReactNode } from 'react';

const base: CSSProperties = {
  position: 'relative',
  // Dark-tinted glass: any bright biolume behind the panel gets darkened
  // *before* light text overlays it, so contrast stays high in every act.
  background:
    'linear-gradient(180deg, rgba(8, 14, 24, 0.66) 0%, rgba(6, 10, 18, 0.72) 100%)',
  backdropFilter: 'blur(22px) saturate(150%) brightness(0.85)',
  WebkitBackdropFilter: 'blur(22px) saturate(150%) brightness(0.85)',
  border: '1px solid rgba(255, 255, 255, 0.16)',
  borderRadius: '1rem',
  boxShadow:
    '0 10px 36px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.10)',
  color: 'rgba(255, 255, 255, 0.96)',
  fontFamily: 'Inter, system-ui, sans-serif',
  willChange: 'opacity, transform',
  overflow: 'hidden',
  pointerEvents: 'auto',
  // Subtle text shadow on everything inside the panel — keeps glyphs
  // crisp against any residual background variance.
  textShadow: '0 1px 2px rgba(0, 0, 0, 0.55)',
};

const sweep: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 'inherit',
  pointerEvents: 'none',
  padding: 1,
  background:
    'conic-gradient(from var(--sweep-angle, 0deg), transparent 0%, transparent 70%, rgba(255,255,255,0.55) 78%, transparent 86%, transparent 100%)',
  WebkitMask:
    'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  WebkitMaskComposite: 'xor',
  maskComposite: 'exclude',
  animation: 'glass-sweep 6s linear infinite',
};

export default function GlassPanel({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div style={{ ...base, ...style }} className={className}>
      <div style={sweep} aria-hidden />
      {/* Inner wrapper passes the outer flex layout through to children so
          overlays can use `display: flex; flex-direction: column` on the
          panel and have a scrollable child fill the remaining height. */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          minHeight: 0,
          maxHeight: 'inherit',
        }}
      >
        {children}
      </div>
    </div>
  );
}
