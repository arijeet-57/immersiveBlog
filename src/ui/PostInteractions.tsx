import { useState, type CSSProperties, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { firebaseConfigured } from '../auth/firebase';
import {
  useComments,
  useLikes,
  usePostStats,
  type Comment,
} from '../auth/usePostInteractions';

const sectionLabel: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.28em',
  opacity: 0.55,
};

const divider: CSSProperties = {
  height: 1,
  background: 'rgba(255,255,255,0.08)',
  margin: '28px 0 20px',
};

const muted: CSSProperties = {
  fontSize: 12.5,
  opacity: 0.6,
  margin: 0,
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path
        d="M12 21s-7.5-4.6-9.5-9.2C1 8.2 3 5 6.3 5c1.9 0 3.6 1 4.7 2.5h2C14.1 6 15.8 5 17.7 5 21 5 23 8.2 21.5 11.8 19.5 16.4 12 21 12 21z"
        fill={filled ? 'rgba(255, 110, 130, 0.95)' : 'none'}
        stroke={filled ? 'rgba(255, 110, 130, 0.95)' : 'rgba(255,255,255,0.7)'}
        strokeWidth={1.6}
      />
    </svg>
  );
}

function formatDate(c: Comment): string {
  const t = c.createdAt?.toDate?.();
  if (!t) return 'just now';
  const diff = Date.now() - t.getTime();
  const min = 60_000, hour = 60 * min, day = 24 * hour;
  if (diff < min) return 'just now';
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return t.toLocaleDateString();
}

function LikeButton({ slug }: { slug: string }) {
  const { count, liked, toggle, canLike, busy } = useLikes(slug);
  const { user } = useAuth();

  return (
    <button
      type="button"
      onClick={() => toggle()}
      disabled={!canLike || busy}
      title={
        !firebaseConfigured
          ? 'Likes are unavailable — Firebase is not configured.'
          : !user
            ? 'Sign in to like this chronicle.'
            : liked
              ? 'Unlike'
              : 'Like'
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.18)',
        background: liked ? 'rgba(255, 110, 130, 0.08)' : 'rgba(255,255,255,0.04)',
        color: 'rgba(255,255,255,0.92)',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13.5,
        cursor: canLike && !busy ? 'pointer' : 'not-allowed',
        opacity: canLike ? 1 : 0.6,
        transition: 'background 160ms ease, border-color 160ms ease',
      }}
    >
      <HeartIcon filled={liked} />
      <span>{count}</span>
    </button>
  );
}

function CommentRow({
  c,
  meUid,
  onDelete,
}: {
  c: Comment;
  meUid: string | null;
  onDelete: (id: string, uid: string) => void;
}) {
  const mine = meUid === c.uid;
  return (
    <li
      style={{
        listStyle: 'none',
        padding: '12px 0',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          backgroundImage: c.photoURL ? `url(${c.photoURL})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          flexShrink: 0,
        }}
        aria-hidden
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {c.displayName || 'Anonymous'}
          </span>
          <span style={{ fontSize: 11, opacity: 0.5 }}>{formatDate(c)}</span>
          {mine && (
            <button
              type="button"
              onClick={() => onDelete(c.id, c.uid)}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,170,170,0.7)',
                fontSize: 11,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              delete
            </button>
          )}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.55,
            opacity: 0.9,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {c.body}
        </p>
      </div>
    </li>
  );
}

function CommentForm({
  onSubmit,
  posting,
}: {
  onSubmit: (body: string) => void;
  posting: boolean;
}) {
  const [body, setBody] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim() || posting) return;
    onSubmit(body);
    setBody('');
  };
  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Leave a whisper…"
        rows={3}
        maxLength={2000}
        style={{
          resize: 'vertical',
          minHeight: 64,
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'rgba(255,255,255,0.04)',
          color: 'rgba(255,255,255,0.92)',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 14,
          lineHeight: 1.5,
          outline: 'none',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, opacity: 0.45 }}>
          {body.length}/2000
        </span>
        <button
          type="submit"
          disabled={!body.trim() || posting}
          style={{
            marginLeft: 'auto',
            padding: '8px 16px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.94)',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 13,
            letterSpacing: '0.04em',
            cursor: body.trim() && !posting ? 'pointer' : 'not-allowed',
            opacity: body.trim() && !posting ? 1 : 0.55,
          }}
        >
          {posting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  );
}

export default function PostInteractions({ slug }: { slug: string }) {
  const { user, ready, signInGoogle, signInGithub } = useAuth();
  const { comments, loading, posting, error, submit, remove, canPost } =
    useComments(slug);

  // If Firebase isn't configured at all, show nothing rather than a broken UI.
  if (!firebaseConfigured) return null;

  return (
    <section style={{ marginTop: 8 }}>
      <div style={divider} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 18,
        }}
      >
        <LikeButton slug={slug} />
        <span style={{ ...sectionLabel }}>
          {comments.length} {comments.length === 1 ? 'COMMENT' : 'COMMENTS'}
        </span>
      </div>

      {canPost ? (
        <CommentForm onSubmit={submit} posting={posting} />
      ) : (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
          }}
        >
          <span style={{ opacity: 0.78 }}>
            {ready ? 'Sign in to like and comment.' : 'Loading…'}
          </span>
          {ready && (
            <>
              <button
                type="button"
                onClick={() => signInGoogle()}
                style={pillBtn}
              >
                Google
              </button>
              <button
                type="button"
                onClick={() => signInGithub()}
                style={pillBtn}
              >
                GitHub
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <p
          style={{
            fontSize: 12,
            color: 'rgba(255, 170, 170, 0.92)',
            marginTop: 10,
          }}
        >
          {error}
        </p>
      )}

      <ul style={{ padding: 0, margin: '18px 0 0', listStyle: 'none' }}>
        {loading && <li style={muted}>Loading whispers…</li>}
        {!loading && comments.length === 0 && (
          <li style={muted}>Be the first to leave a whisper.</li>
        )}
        {comments.map((c) => (
          <CommentRow
            key={c.id}
            c={c}
            meUid={user?.uid ?? null}
            onDelete={remove}
          />
        ))}
      </ul>
    </section>
  );
}

// Compact like + comment count chip for index/listing views. Reads once
// (no live listeners) — see usePostStats.
export function PostStats({ slug }: { slug: string }) {
  const { likeCount, commentCount } = usePostStats(slug);
  if (!firebaseConfigured) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 11.5,
        opacity: 0.55,
        fontVariantNumeric: 'tabular-nums',
      }}
      aria-label={`${likeCount} likes, ${commentCount} comments`}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <HeartIcon filled={false} />
        {likeCount}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <SpeechIcon />
        {commentCount}
      </span>
    </span>
  );
}

function SpeechIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden>
      <path
        d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
        fill="none"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

const pillBtn: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(255,255,255,0.92)',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  cursor: 'pointer',
};
