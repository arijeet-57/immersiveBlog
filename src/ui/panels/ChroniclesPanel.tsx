import { Link } from 'react-router-dom';
import GlassPanel from '../GlassPanel';
import { usePinClose } from './usePinClose';
import { posts } from '../../content/posts';

const RECENT = posts.slice(0, 5);

export default function ChroniclesPanel() {
  const { pinned, close } = usePinClose('chronicles');
  return (
    <GlassPanel style={{ padding: '22px 24px', width: 340 }}>
      {pinned && (
        <button className="panel-close" onClick={close} aria-label="Close">
          ×
        </button>
      )}
      <div style={{ fontSize: 11, letterSpacing: '0.28em', opacity: 0.55, marginBottom: 12 }}>
        CHRONICLES
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {RECENT.map((p) => (
          <li key={p.slug} style={{ marginBottom: 12 }}>
            <Link
              to={`/chronicles/${p.slug}`}
              style={{
                color: 'inherit',
                textDecoration: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: 13.5,
                opacity: 0.88,
              }}
            >
              <span>{p.title}</span>
              <span style={{ opacity: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                {p.date.slice(5)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
