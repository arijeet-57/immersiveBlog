import type { CSSProperties } from 'react';
import { useAppStore, type Theme } from '../store/appStore';

const wrap: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 12,
  marginRight: 4,
};

const btn: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  display: 'inline-grid',
  placeItems: 'center',
  width: 22,
  height: 22,
  color: 'rgba(255,255,255,0.55)',
  transition: 'color 160ms ease, transform 160ms ease',
  font: 'inherit',
};

const btnActive: CSSProperties = {
  color: '#fff',
};

function Dawn() {
  // Sunset on a horizon line
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="14" r="4" />
      <path d="M3 18h18" />
      <path d="M12 6V4M5 8.5l-1.4-1.4M19 8.5l1.4-1.4" />
    </svg>
  );
}

function Day() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
    </svg>
  );
}

function Night() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M21 13.5A8.5 8.5 0 0 1 10.5 3a1 1 0 0 0-1.4-1.1A10 10 0 1 0 22.1 14.9a1 1 0 0 0-1.1-1.4z" />
    </svg>
  );
}

const ICONS: Record<Theme, () => JSX.Element> = {
  dawn: Dawn,
  day: Day,
  night: Night,
};

const LABELS: Record<Theme, string> = {
  dawn: 'Dawn',
  day: 'Day',
  night: 'Night',
};

const ORDER: Theme[] = ['dawn', 'day', 'night'];

export default function ThemeSwitcher() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <div style={wrap} role="radiogroup" aria-label="Time of day">
      {ORDER.map((t) => {
        const Icon = ICONS[t];
        const active = t === theme;
        return (
          <button
            key={t}
            type="button"
            style={{ ...btn, ...(active ? btnActive : null) }}
            onClick={() => setTheme(t)}
            aria-label={LABELS[t]}
            title={LABELS[t]}
            role="radio"
            aria-checked={active}
            onMouseEnter={(e) => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)';
            }}
            onMouseLeave={(e) => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)';
            }}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
