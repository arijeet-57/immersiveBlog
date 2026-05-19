import { Link } from 'react-router-dom';
import GlassPanel from '../GlassPanel';
import { usePinClose } from './usePinClose';
import { posts } from '../../content/posts';

// The full post body opens in the in-page ChronicleReader overlay, so this
// in-scroll panel always renders the latest-post teaser.
export default function FeaturedPostPanel() {
  const { pinned, close } = usePinClose('featured');
  const post = posts[0];

  if (!post) {
    return (
      <GlassPanel style={{ padding: '24px 26px', width: 380 }}>
        {pinned && (
          <button className="panel-close" onClick={close} aria-label="Close">
            ×
          </button>
        )}
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          No chronicles yet.
        </div>
      </GlassPanel>
    );
  }

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
        {post.title}
      </h2>
      <div style={{ marginTop: 4, fontSize: 11, opacity: 0.5, letterSpacing: '0.06em' }}>
        {post.date} · {post.author}
      </div>
      <div
        style={{
          marginTop: 14,
          height: 110,
          borderRadius: 10,
          background: post.hero,
        }}
      />
      <p style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.6, opacity: 0.82 }}>
        {post.excerpt}
      </p>
      <Link
        to={`/chronicles/${post.slug}`}
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
      </Link>
    </GlassPanel>
  );
}
