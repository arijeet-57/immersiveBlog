import { Link } from 'react-router-dom';
import GlassPanel from '../GlassPanel';
import { usePinClose } from './usePinClose';

export default function SanctuaryPanel() {
  const { pinned, close } = usePinClose('sanctuary');
  return (
    <GlassPanel style={{ padding: '22px 24px', width: 320 }}>
      {pinned && (
        <button className="panel-close" onClick={close} aria-label="Close">
          ×
        </button>
      )}
      <div style={{ fontSize: 11, letterSpacing: '0.28em', opacity: 0.55, marginBottom: 8 }}>
        SANCTUARY
      </div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, opacity: 0.82 }}>
        A private room beneath the canopy. Notes and journals for the trusted few.
      </p>
      <Link
        to="/sanctuary"
        style={{
          marginTop: 14,
          display: 'inline-block',
          padding: '8px 16px',
          border: '1px solid rgba(255,255,255,0.22)',
          borderRadius: 999,
          color: 'inherit',
          textDecoration: 'none',
          fontSize: 12,
          letterSpacing: '0.18em',
        }}
      >
        ENTER SANCTUARY
      </Link>
    </GlassPanel>
  );
}
