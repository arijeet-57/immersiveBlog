import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GlassPanel from './GlassPanel';
import OverlayControls from './OverlayControls';
import PostInteractions from './PostInteractions';
import { getPost } from '../content/posts';
import { useFirestoreChronicle } from '../content/firestoreChronicles';
import { useIsOwner } from '../auth/owner';

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 30,
  display: 'grid',
  placeItems: 'center',
  padding: '88px 24px 32px',
  pointerEvents: 'auto',
  background:
    'radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)',
};

const panelStyle: CSSProperties = {
  width: 'min(720px, 100%)',
  maxHeight: 'calc(100vh - 120px)',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: CSSProperties = {
  padding: '24px 32px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const bodyStyle: CSSProperties = {
  padding: '20px 32px 32px',
  overflowY: 'auto',
  minHeight: 0,
  flex: 1,
  fontSize: 15,
  lineHeight: 1.7,
  color: 'rgba(255,255,255,0.88)',
};

export default function ChronicleReader() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const mdxPost = getPost(slug);
  // Always check Firestore — a promoted version of an MDX post should win.
  const { chronicle, loading, notFound } = useFirestoreChronicle(slug);
  const owner = useIsOwner();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/chronicles');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const visibleFirestore = chronicle && (!chronicle.hidden || owner);
  // Firestore version takes priority, BUT if its body is empty (a "promote
  // shell" created when an MDX post was first hidden/pinned), we still render
  // the MDX file body — flags are honoured, content stays.
  const useFirestoreBody = !!visibleFirestore && !!chronicle.body?.trim();

  if (useFirestoreBody) {
    return (
      <ReaderShell
        post={{
          slug: chronicle!.slug,
          title: chronicle!.title,
          date: chronicle!.date,
          author: chronicle!.author,
          excerpt: chronicle!.excerpt,
          body: chronicle!.body,
        }}
        kind="firestore"
      />
    );
  }

  // Render MDX file — either there's no Firestore doc, or the Firestore doc
  // is a body-less flag override and metadata visibility is already enforced.
  if (mdxPost && (!chronicle?.hidden || owner)) {
    return <ReaderShell post={mdxPost} kind="mdx" />;
  }

  if (loading) {
    return (
      <div style={overlay} onClick={() => navigate('/chronicles')}>
        <GlassPanel style={panelStyle}>
          <OverlayControls closeTo="/chronicles" />
          <div style={{ padding: '36px 32px', opacity: 0.6 }}>Unfurling…</div>
        </GlassPanel>
      </div>
    );
  }

  if (notFound || !chronicle) {
    return (
      <>
        <Helmet><title>Not found · Chronicles · Ethereal Valley</title></Helmet>
        <div style={overlay} onClick={() => navigate('/chronicles')}>
          <GlassPanel style={panelStyle}>
            <OverlayControls closeTo="/chronicles" />
            <div style={{ padding: '36px 32px' }}>
              <p style={{ margin: 0, opacity: 0.78 }}>
                That chronicle could not be found.
              </p>
            </div>
          </GlassPanel>
        </div>
      </>
    );
  }

  return null;
}

interface ReaderPost {
  slug: string;
  title: string;
  date: string;
  author: string;
  excerpt: string;
  Component?: React.ComponentType;
  body?: string;
}

function ReaderShell({
  post,
  kind,
}: {
  post: ReaderPost;
  kind: 'mdx' | 'firestore';
}) {
  const navigate = useNavigate();
  const Body = post.Component;

  return (
    <>
      <Helmet>
        <title>{post.title} · Chronicles · Ethereal Valley</title>
        <meta name="description" content={post.excerpt} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        <meta property="article:published_time" content={post.date} />
        <meta property="article:author" content={post.author} />
      </Helmet>
      <div
        style={overlay}
        onClick={() => navigate('/chronicles')}
        role="dialog"
        aria-modal="true"
        aria-label={post.title}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: 'min(720px, 100%)' }}
        >
          <GlassPanel style={panelStyle}>
            <OverlayControls closeTo="/chronicles" />
            <header style={headerStyle}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.28em',
                  opacity: 0.55,
                  marginBottom: 10,
                }}
              >
                CHRONICLE · {post.date}
              </div>
              <h1 style={{ margin: 0, fontSize: 26, letterSpacing: '0.01em', fontWeight: 500 }}>
                {post.title}
              </h1>
              <div style={{ marginTop: 8, fontSize: 12.5, opacity: 0.6 }}>
                by {post.author}
              </div>
            </header>
            <article
              className="chronicle-body"
              style={bodyStyle}
              data-lenis-prevent
            >
              {kind === 'mdx' && Body ? (
                <Body />
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {post.body ?? ''}
                </ReactMarkdown>
              )}
              <PostInteractions slug={post.slug} />
            </article>
          </GlassPanel>
        </div>
      </div>
    </>
  );
}
