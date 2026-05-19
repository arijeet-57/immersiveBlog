import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import GlassPanel from '../ui/GlassPanel';
import OverlayControls from '../ui/OverlayControls';
import SignInCard from '../ui/SignInCard';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../auth/firebase';

interface Whisper {
  id: string;
  text: string;
  authorName: string;
  authorId: string;
  authorPhoto: string | null;
  createdAt: Timestamp | null;
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 30,
  display: 'grid',
  placeItems: 'center',
  padding: '88px 24px 32px',
  pointerEvents: 'auto',
  background:
    'radial-gradient(ellipse at center, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.55) 100%)',
};

const panelStyle: CSSProperties = {
  width: 'min(560px, 100%)',
  maxHeight: 'calc(100vh - 120px)',
  display: 'flex',
  flexDirection: 'column',
};

const MAX_LEN = 240;

function relativeTime(ts: Timestamp | null): string {
  if (!ts) return 'just now';
  const sec = Math.max(0, (Date.now() - ts.toMillis()) / 1000);
  if (sec < 60) return `${Math.floor(sec)}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export default function Whispers() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [whispers, setWhispers] = useState<Whisper[]>([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !db) return;
    const q = query(collection(db, 'whispers'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: Whisper[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            text: String(data.text ?? ''),
            authorName: String(data.authorName ?? 'someone'),
            authorId: String(data.authorId ?? ''),
            authorPhoto: data.authorPhoto ?? null,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
          };
        });
        setWhispers(items);
      },
      (err) => {
        setPostError(`Could not load whispers: ${err.message}`);
      },
    );
    return unsub;
  }, [user]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user || !db) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setPosting(true);
    setPostError(null);
    try {
      await addDoc(collection(db, 'whispers'), {
        text: trimmed.slice(0, MAX_LEN),
        authorName: user.displayName ?? user.email ?? 'anon',
        authorId: user.uid,
        authorPhoto: user.photoURL ?? null,
        createdAt: serverTimestamp(),
      });
      setText('');
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Could not post whisper.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Whispers · Ethereal Valley</title>
        <meta name="description" content="A guestbook for the valley — sign in to read and leave a whisper." />
      </Helmet>
      <div
        style={overlay}
        onClick={() => navigate('/')}
        role="dialog"
        aria-modal="true"
        aria-label="Whispers"
      >
        <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)' }}>
          <GlassPanel style={panelStyle}>
            <OverlayControls />

            <div style={{ padding: '24px 28px 12px' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.28em', opacity: 0.55, marginBottom: 8 }}>
                WHISPERS
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>
                A guestbook for the valley
              </h1>
              <p style={{ marginTop: 6, fontSize: 13, opacity: 0.65 }}>
                {user ? 'Leave a line. Read what others left behind.' : 'Sign in to read and leave a whisper.'}
              </p>
            </div>

            {loading ? (
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: '0.22em',
                  opacity: 0.6,
                  textAlign: 'center',
                  padding: '40px 0',
                }}
              >
                LISTENING…
              </div>
            ) : !user ? (
              <div style={{ padding: '8px 28px 26px' }}>
                <SignInCard
                  title="SIGN IN TO ENTER"
                  subtitle="Whispers are visible only to those who have signed in."
                />
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <form
                  onSubmit={submit}
                  style={{
                    padding: '8px 28px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
                    placeholder="Leave a whisper…"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.16)',
                      background: 'rgba(0,0,0,0.25)',
                      color: 'rgba(255,255,255,0.94)',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 11.5,
                      opacity: 0.6,
                    }}
                  >
                    <span>{MAX_LEN - text.length} left</span>
                    <button
                      type="submit"
                      disabled={posting || !text.trim() || !db}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.22)',
                        background: text.trim() ? 'rgba(120,180,255,0.18)' : 'transparent',
                        color: 'inherit',
                        fontSize: 11.5,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        cursor: posting || !text.trim() ? 'not-allowed' : 'pointer',
                        opacity: posting || !text.trim() ? 0.45 : 1,
                        transition: 'background 160ms ease',
                      }}
                    >
                      {posting ? 'Sending…' : 'Whisper'}
                    </button>
                  </div>
                  {postError && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: 'rgba(255,170,170,0.95)',
                        padding: '6px 10px',
                        background: 'rgba(255, 80, 80, 0.08)',
                        border: '1px solid rgba(255, 80, 80, 0.22)',
                        borderRadius: 8,
                      }}
                    >
                      {postError}
                    </div>
                  )}
                </form>

                <ul
                  data-lenis-prevent
                  style={{
                    listStyle: 'none',
                    padding: '0 28px 22px',
                    margin: 0,
                    overflowY: 'auto',
                    minHeight: 0,
                    flex: 1,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {whispers.length === 0 ? (
                    <li
                      style={{
                        padding: '24px 0',
                        textAlign: 'center',
                        fontSize: 12.5,
                        opacity: 0.5,
                      }}
                    >
                      Nothing yet. Be the first whisper.
                    </li>
                  ) : (
                    whispers.map((w) => (
                      <li
                        key={w.id}
                        style={{
                          padding: '14px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          display: 'flex',
                          gap: 12,
                        }}
                      >
                        {w.authorPhoto ? (
                          <img
                            src={w.authorPhoto}
                            alt=""
                            referrerPolicy="no-referrer"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              border: '1px solid rgba(255,255,255,0.18)',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              border: '1px solid rgba(255,255,255,0.18)',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 11,
                              flexShrink: 0,
                              marginTop: 2,
                              background: 'rgba(255,255,255,0.05)',
                            }}
                            aria-hidden
                          >
                            {w.authorName[0]?.toUpperCase() ?? '·'}
                          </span>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              gap: 8,
                              alignItems: 'baseline',
                              fontSize: 12,
                              opacity: 0.7,
                            }}
                          >
                            <span style={{ fontWeight: 500 }}>{w.authorName}</span>
                            <span style={{ opacity: 0.55 }}>· {relativeTime(w.createdAt)}</span>
                          </div>
                          <p
                            style={{
                              margin: '4px 0 0',
                              fontSize: 13.5,
                              lineHeight: 1.55,
                              opacity: 0.92,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {w.text}
                          </p>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </GlassPanel>
        </div>
      </div>
    </>
  );
}
