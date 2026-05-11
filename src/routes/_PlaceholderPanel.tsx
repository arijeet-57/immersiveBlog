import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

const wrap: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'none',
  zIndex: 10,
};

const panel: CSSProperties = {
  pointerEvents: 'auto',
  minWidth: 320,
  maxWidth: 480,
  padding: '24px 28px',
  background: 'rgba(8, 14, 24, 0.55)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 12,
  color: 'rgba(255,255,255,0.92)',
  font: '14px/1.5 Inter, system-ui, sans-serif',
  backdropFilter: 'blur(12px)',
};

const btn: CSSProperties = {
  marginTop: 16,
  padding: '6px 14px',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.25)',
  color: 'inherit',
  borderRadius: 999,
  cursor: 'pointer',
  font: 'inherit',
};

export default function PlaceholderPanel({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div style={wrap}>
      <div style={panel}>
        <h2 style={{ margin: 0, fontWeight: 500, letterSpacing: '0.04em' }}>{title}</h2>
        <div style={{ marginTop: 12, opacity: 0.78 }}>{children}</div>
        <button
          style={btn}
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        >
          Close
        </button>
      </div>
    </div>
  );
}
