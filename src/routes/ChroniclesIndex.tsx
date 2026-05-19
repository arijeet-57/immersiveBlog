import type { CSSProperties } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import GlassPanel from '../ui/GlassPanel';
import OverlayControls from '../ui/OverlayControls';
import { posts } from '../content/posts';

const SITE = 'Ethereal Valley';
const RECENT = posts.slice(0, 5);

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 30,
  display: 'grid',
  placeItems: 'center',
  padding: '88px 24px 32px',
  pointerEvents: 'auto',
  background:
    'radial-gradient(ellipse at center, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.50) 100%)',
};

const panelStyle: CSSProperties = {
  width: 'min(560px, 100%)',
  maxHeight: 'calc(100vh - 120px)',
  display: 'flex',
  flexDirection: 'column',
};

export default function ChroniclesIndex() {
  const navigate = useNavigate();
  const description = `Field notes from the valley — ${posts.length} chronicles, latest: "${posts[0]?.title ?? ''}".`;

  return (
    <>
      <Helmet>
        <title>Chronicles · {SITE}</title>
        <meta name="description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`Chronicles · ${SITE}`} />
        <meta property="og:description" content={description} />
      </Helmet>
      <div
        style={overlay}
        onClick={() => navigate('/')}
        role="dialog"
        aria-modal="true"
        aria-label="Chronicles index"
      >
        <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)' }}>
          <GlassPanel style={panelStyle}>
            <OverlayControls />
            <div style={{ padding: '24px 28px 8px' }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.28em',
                  opacity: 0.55,
                  marginBottom: 8,
                }}
              >
                CHRONICLES
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>
                Field notes from the valley
              </h1>
              <p style={{ marginTop: 6, fontSize: 13, opacity: 0.65 }}>
                The {Math.min(5, posts.length)} most recent.
              </p>
            </div>
            <ul
              data-lenis-prevent
              style={{
                listStyle: 'none',
                padding: '8px 16px 22px',
                margin: 0,
                overflowY: 'auto',
                minHeight: 0,
                flex: 1,
              }}
            >
              {RECENT.map((p) => (
                <li key={p.slug}>
                  <Link
                    to={`/chronicles/${p.slug}`}
                    style={{
                      display: 'block',
                      padding: '14px 12px',
                      borderRadius: 10,
                      color: 'inherit',
                      textDecoration: 'none',
                      transition: 'background 160ms ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background =
                        'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        fontSize: 14.5,
                        fontWeight: 500,
                        opacity: 0.95,
                      }}
                    >
                      <span>{p.title}</span>
                      <span
                        style={{
                          opacity: 0.5,
                          fontSize: 12,
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.date}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: '6px 0 0',
                        fontSize: 12.5,
                        lineHeight: 1.55,
                        opacity: 0.65,
                      }}
                    >
                      {p.excerpt}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </GlassPanel>
        </div>
      </div>
    </>
  );
}
