import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

const wrap: CSSProperties = {
  position: 'fixed',
  top: 20,
  left: 24,
  zIndex: 20,
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontFamily: 'Inter, system-ui, sans-serif',
  color: 'rgba(255,255,255,0.88)',
  textDecoration: 'none',
};

const dot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background:
    'radial-gradient(circle at 30% 30%, #aee4ff, #4da0ff 55%, #1a3a8a 100%)',
  boxShadow: '0 0 12px rgba(120, 180, 255, 0.7)',
};

export default function Hud() {
  return (
    <Link to="/" style={wrap}>
      <span style={dot} />
      <span style={{ fontSize: 13, letterSpacing: '0.22em' }}>ETHEREAL VALLEY</span>
    </Link>
  );
}
