import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

const wrap: CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 12,
  display: 'flex',
  gap: 6,
  zIndex: 2,
};

const btn: CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  color: 'rgba(255, 255, 255, 0.78)',
  width: 26,
  height: 26,
  borderRadius: 999,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  padding: 0,
  transition: 'background 160ms ease, color 160ms ease',
};

interface Props {
  /** Where the × close button should navigate. Defaults to "/". */
  closeTo?: string;
  /** Hide the back button (e.g. when there's no useful history). */
  hideBack?: boolean;
}

export default function OverlayControls({ closeTo = '/', hideBack }: Props) {
  const navigate = useNavigate();

  return (
    <div style={wrap}>
      {!hideBack && (
        <button
          type="button"
          style={btn}
          onClick={() => navigate(-1)}
          aria-label="Back"
          title="Back"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
            (e.currentTarget as HTMLButtonElement).style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.78)';
          }}
        >
          ‹
        </button>
      )}
      <button
        type="button"
        style={btn}
        onClick={() => navigate(closeTo)}
        aria-label="Close"
        title="Close"
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
          (e.currentTarget as HTMLButtonElement).style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.78)';
        }}
      >
        ×
      </button>
    </div>
  );
}
