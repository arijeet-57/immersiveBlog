import { Link } from 'react-router-dom';
import GlassPanel from '../GlassPanel';
import { usePinClose } from './usePinClose';

const PLACEHOLDER_POSTS = [
  { slug: 'first-bloom',     title: 'The First Bloom',          date: '2026-04-12' },
  { slug: 'a-quiet-river',   title: 'A Quiet River',            date: '2026-04-29' },
  { slug: 'between-trunks',  title: 'Between Trunks',           date: '2026-05-02' },
  { slug: 'moonlight-shape', title: 'The Shape of Moonlight',   date: '2026-05-06' },
  { slug: 'last-firefly',    title: 'The Last Firefly Tonight', date: '2026-05-10' },
];

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
        {PLACEHOLDER_POSTS.map((p) => (
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
