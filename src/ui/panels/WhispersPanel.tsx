import { Link } from 'react-router-dom';
import GlassPanel from '../GlassPanel';
import { usePinClose } from './usePinClose';

const WHISPERS = [
  { from: 'k.', text: 'thank you for keeping the light on' },
  { from: 'mira', text: 'i found this on a hard night and stayed' },
  { from: 'anon', text: 'the river piece undid me, in a good way' },
];

export default function WhispersPanel() {
  const { pinned, close } = usePinClose('whispers');
  return (
    <GlassPanel style={{ padding: '22px 26px', width: 440 }}>
      {pinned && (
        <button className="panel-close" onClick={close} aria-label="Close">
          ×
        </button>
      )}
      <div style={{ fontSize: 11, letterSpacing: '0.28em', opacity: 0.55, marginBottom: 10 }}>
        WHISPERS
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {WHISPERS.map((w, i) => (
          <li
            key={i}
            style={{
              padding: '8px 0',
              borderBottom: i < WHISPERS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              fontSize: 13,
              lineHeight: 1.5,
              opacity: 0.85,
            }}
          >
            <span style={{ opacity: 0.55, marginRight: 8 }}>{w.from}</span>
            {w.text}
          </li>
        ))}
      </ul>
      <Link
        to="/whispers"
        style={{
          marginTop: 14,
          display: 'inline-block',
          fontSize: 12,
          letterSpacing: '0.18em',
          color: 'rgba(180, 220, 255, 0.92)',
          textDecoration: 'none',
        }}
      >
        LEAVE A WHISPER →
      </Link>
    </GlassPanel>
  );
}
