import GlassPanel from '../GlassPanel';
import { usePinClose } from './usePinClose';

export default function FeaturedPostPanel() {
  const { pinned, close } = usePinClose('featured');
  return (
    <GlassPanel style={{ padding: '24px 26px', width: 380 }}>
      {pinned && (
        <button className="panel-close" onClick={close} aria-label="Close">
          ×
        </button>
      )}
      <div style={{ fontSize: 11, letterSpacing: '0.28em', opacity: 0.55, marginBottom: 8 }}>
        FEATURED
      </div>
      <h2 style={{ margin: 0, fontWeight: 400, fontSize: 22, letterSpacing: '0.01em' }}>
        The Last Firefly Tonight
      </h2>
      <div style={{ marginTop: 4, fontSize: 11, opacity: 0.5, letterSpacing: '0.06em' }}>
        2026-05-10 · Arro
      </div>
      <div
        style={{
          marginTop: 14,
          height: 110,
          borderRadius: 10,
          background:
            'radial-gradient(circle at 30% 40%, rgba(80,140,255,0.45), transparent 55%), radial-gradient(circle at 70% 60%, rgba(255,220,140,0.25), transparent 55%), #0a1224',
        }}
      />
      <p style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.6, opacity: 0.82 }}>
        I waited at the edge of the meadow until the air had nothing left to say. The last firefly
        was small and stubborn — a single warm point against the cold blue field, refusing to leave
        until I did.
      </p>
      <a
        href="/chronicles/last-firefly"
        style={{
          marginTop: 14,
          display: 'inline-block',
          fontSize: 12,
          letterSpacing: '0.18em',
          color: 'rgba(180, 220, 255, 0.92)',
          textDecoration: 'none',
        }}
      >
        READ FULL →
      </a>
    </GlassPanel>
  );
}
