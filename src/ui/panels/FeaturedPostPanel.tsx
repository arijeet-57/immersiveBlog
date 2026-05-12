import { useMemo } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import GlassPanel from '../GlassPanel';
import { usePinClose } from './usePinClose';
import { posts, getPost } from '../../content/posts';

// When on /chronicles/:slug this panel renders the full MDX body. Otherwise
// it shows the newest post's hero + excerpt as a teaser linking to the post.
export default function FeaturedPostPanel() {
  const { pinned, close } = usePinClose('featured');
  const { slug } = useParams();
  const location = useLocation();
  const isPostRoute = location.pathname.startsWith('/chronicles/');

  const post = useMemo(() => {
    if (isPostRoute) return getPost(slug);
    return posts[0];
  }, [isPostRoute, slug]);

  if (!post) {
    return (
      <GlassPanel style={{ padding: '24px 26px', width: 380 }}>
        {pinned && (
          <button className="panel-close" onClick={close} aria-label="Close">
            ×
          </button>
        )}
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          That chronicle could not be found. <Link to="/" style={{ color: 'rgba(180,220,255,0.92)' }}>Return home →</Link>
        </div>
      </GlassPanel>
    );
  }

  const PostBody = post.Component;

  return (
    <GlassPanel
      style={{
        padding: '24px 26px',
        width: isPostRoute ? 460 : 380,
        maxHeight: isPostRoute ? '78vh' : undefined,
        overflowY: isPostRoute ? 'auto' : 'visible',
      }}
    >
      {pinned && (
        <button className="panel-close" onClick={close} aria-label="Close">
          ×
        </button>
      )}
      <div style={{ fontSize: 11, letterSpacing: '0.28em', opacity: 0.55, marginBottom: 8 }}>
        {isPostRoute ? 'CHRONICLE' : 'FEATURED'}
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
      {isPostRoute ? (
        <div className="post-body" style={{ marginTop: 14, fontSize: 14, lineHeight: 1.65, opacity: 0.9 }}>
          <PostBody />
        </div>
      ) : (
        <>
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
        </>
      )}
    </GlassPanel>
  );
}
