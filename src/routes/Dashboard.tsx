import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../auth/firebase';
import { useAuth } from '../auth/AuthProvider';
import { useIsOwner } from '../auth/owner';
import {
  buildEditorSeed,
  deleteChronicle,
  mdxSlugs,
  promoteMdxToFirestore,
  upsertChronicle,
  useChronicleList,
  validateSlug,
  type ChronicleListItem,
  type FirestoreChronicle,
} from '../content/firestoreChronicles';

interface CommentRow {
  id: string;
  slug: string;
  uid: string;
  displayName: string;
  body: string;
  createdAt: Timestamp | null;
}

interface EditorState {
  mode: 'create' | 'edit';
  initial: Partial<FirestoreChronicle>;
}

export default function Dashboard() {
  const { user, ready } = useAuth();
  const owner = useIsOwner();
  const [editor, setEditor] = useState<EditorState | null>(null);

  if (!ready) return <Shell><p style={muted}>Resolving…</p></Shell>;
  if (!user) return <Navigate to="/" replace />;
  if (!owner) {
    return (
      <Shell>
        <p style={muted}>This passage is for the maintainer only.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <Helmet><title>Dashboard · Ethereal Valley</title></Helmet>
      <Overview />
      <ChroniclesManager onEdit={setEditor} ownerUid={user.uid} />
      <RecentComments />
      {editor && (
        <ChronicleEditor
          mode={editor.mode}
          initial={editor.initial}
          ownerUid={user.uid}
          onClose={() => setEditor(null)}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={page}>
      <div style={container}>
        <div style={kicker}>MAINTAINER</div>
        <h1 style={heading}>Dashboard</h1>
        {children}
      </div>
    </main>
  );
}

function Overview() {
  const [stats, setStats] = useState<{
    users: number;
    likes: number;
    comments: number;
    chronicles: number;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { items } = useChronicleList();

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    (async () => {
      try {
        const [u, l, c] = await Promise.all([
          getCountFromServer(collection(db!, 'users')),
          getCountFromServer(collectionGroup(db!, 'likes')),
          getCountFromServer(collectionGroup(db!, 'comments')),
        ]);
        if (cancelled) return;
        setStats({
          users: u.data().count,
          likes: l.data().count,
          comments: c.data().count,
          chronicles: items.length,
        });
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load stats.');
      }
    })();
    return () => { cancelled = true; };
  }, [items.length]);

  return (
    <section style={{ marginTop: 24 }}>
      <div style={sectionLabel}>OVERVIEW</div>
      <div style={tileGrid}>
        <Tile label="Chronicles" value={stats?.chronicles ?? items.length} />
        <Tile label="Travelers"  value={stats?.users}    loading={!stats} />
        <Tile label="Likes"      value={stats?.likes}    loading={!stats} />
        <Tile label="Whispers"   value={stats?.comments} loading={!stats} />
      </div>
      {err && <p style={errorText}>{err}</p>}
    </section>
  );
}

function Tile({
  label,
  value,
  loading,
}: {
  label: string;
  value?: number;
  loading?: boolean;
}) {
  return (
    <div style={tile}>
      <div style={tileLabel}>{label.toUpperCase()}</div>
      <div style={tileValue}>{loading ? '…' : (value ?? 0).toLocaleString()}</div>
    </div>
  );
}

function ChroniclesManager({
  onEdit,
  ownerUid,
}: {
  onEdit: (s: EditorState) => void;
  ownerUid: string;
}) {
  const { items, getMdx, getFirestore } = useChronicleList();
  const [stats, setStats] = useState<Record<string, { likes: number; comments: number }>>({});

  useEffect(() => {
    if (!db || items.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        items.map(async (it) => {
          try {
            const [postSnap, count] = await Promise.all([
              getDoc(doc(db!, 'posts', it.slug)),
              getCountFromServer(collection(db!, 'posts', it.slug, 'comments')),
            ]);
            const data = postSnap.data();
            return [
              it.slug,
              {
                likes: typeof data?.likeCount === 'number' ? data.likeCount : 0,
                comments: count.data().count,
              },
            ] as const;
          } catch {
            return [it.slug, { likes: 0, comments: 0 }] as const;
          }
        }),
      );
      if (!cancelled) setStats(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [items]);

  // Promote-on-action: if the row is MDX-only, copy it into Firestore first
  // and apply the toggle in one shot. Result is the live Firestore doc.
  const ensureFirestore = async (
    it: ChronicleListItem,
    overrides: Partial<Pick<FirestoreChronicle, 'hidden' | 'pinned'>> = {},
  ): Promise<FirestoreChronicle | null> => {
    const existing = getFirestore(it.slug);
    if (existing) return existing;
    const mdx = getMdx(it.slug);
    if (!mdx) return null;
    return promoteMdxToFirestore(mdx, ownerUid, overrides);
  };

  const onToggleHidden = async (it: ChronicleListItem) => {
    try {
      const fs = await ensureFirestore(it, { hidden: !it.hidden });
      if (!fs) return;
      // ensureFirestore handles the create case with the desired flag.
      // Only the existing-doc case needs a follow-up update.
      if (getFirestore(it.slug)) {
        await upsertChronicle(fs.ownerUid, { ...fs, hidden: !fs.hidden }, false);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not toggle visibility.');
    }
  };

  const onTogglePinned = async (it: ChronicleListItem) => {
    try {
      const fs = await ensureFirestore(it, { pinned: !it.pinned });
      if (!fs) return;
      if (getFirestore(it.slug)) {
        await upsertChronicle(fs.ownerUid, { ...fs, pinned: !fs.pinned }, false);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not toggle pin.');
    }
  };

  const onDelete = async (it: ChronicleListItem) => {
    const hasMdxFallback = !!getMdx(it.slug);
    const hasFirestore = !!getFirestore(it.slug);
    const msg = hasMdxFallback
      ? `Remove the Firestore copy of "${it.title}"? The original MDX file will become visible again.`
      : `Delete "${it.title}"? Likes and comments on it will remain.`;
    if (!confirm(msg)) return;
    try {
      if (hasFirestore) await deleteChronicle(it.slug);
      // MDX-only with no Firestore copy: nothing to delete; the file lives in code.
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  const startEdit = (it: ChronicleListItem) => {
    const fs = getFirestore(it.slug);
    const mdx = getMdx(it.slug);
    // If the post is MDX-only, the editor's "save" will create the Firestore
    // copy (promote on save). buildEditorSeed hydrates the form with rawBody.
    onEdit({
      mode: fs ? 'edit' : 'create',
      initial: buildEditorSeed(mdx, fs),
    });
  };

  return (
    <section style={{ marginTop: 36 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <div style={sectionLabel}>CHRONICLES</div>
        <button
          type="button"
          onClick={() => onEdit({ mode: 'create', initial: {} })}
          style={primaryBtn}
        >
          + new chronicle
        </button>
      </div>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Title</th>
              <th style={th}>Source</th>
              <th style={{ ...th, textAlign: 'right' }}>Likes</th>
              <th style={{ ...th, textAlign: 'right' }}>Comments</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const s = stats[it.slug] ?? { likes: 0, comments: 0 };
              return (
                <tr key={`${it.source}:${it.slug}`}>
                  <td style={td}>
                    <a href={`/chronicles/${it.slug}`} style={link}>{it.title}</a>
                    <div style={tdSub}>
                      {it.slug} · {it.date}
                      {it.hidden && <span style={hiddenBadge}>hidden</span>}
                    </div>
                  </td>
                  <td style={td}>
                    <span style={it.source === 'mdx' ? mdxBadge : fsBadge}>
                      {it.source === 'mdx' ? 'MDX' : it.source === 'firestore' ? 'Firestore' : 'MDX → Firestore'}
                    </span>
                    {it.pinned && <span style={pinBadge}>pinned</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {s.likes}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {s.comments}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => startEdit(it)} style={tinyBtn}>
                        edit
                      </button>
                      <button type="button" onClick={() => onTogglePinned(it)} style={tinyBtn}>
                        {it.pinned ? 'unpin' : 'pin'}
                      </button>
                      <button type="button" onClick={() => onToggleHidden(it)} style={tinyBtn}>
                        {it.hidden ? 'show' : 'hide'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(it)}
                        disabled={it.source === 'mdx'}
                        style={{ ...tinyDanger, opacity: it.source === 'mdx' ? 0.35 : 1, cursor: it.source === 'mdx' ? 'not-allowed' : 'pointer' }}
                        title={it.source === 'mdx' ? 'MDX file — edit or hide it instead' : ''}
                      >
                        delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ ...muted, marginTop: 10, fontSize: 11.5 }}>
        MDX chronicles live as files under <code>content/chronicles/</code> and
        are edited in your code editor. Firestore chronicles are managed here.
      </p>
    </section>
  );
}

function ChronicleEditor({
  mode,
  initial,
  ownerUid,
  onClose,
}: {
  mode: 'create' | 'edit';
  initial: Partial<FirestoreChronicle>;
  ownerUid: string;
  onClose: () => void;
}) {
  const { items } = useChronicleList();
  const reservedSlugs = useMemo(() => {
    const s = new Set<string>(mdxSlugs);
    for (const it of items) if (it.source === 'firestore' || it.source === 'mdx+firestore') s.add(it.slug);
    // Allow re-saving the same slug when editing, OR when promoting an MDX
    // post (mode='create' but initial.slug points at the existing MDX file).
    if (initial.slug) s.delete(initial.slug);
    return s;
  }, [items, initial.slug]);

  const [title, setTitle] = useState(initial.title ?? '');
  const [slug, setSlug] = useState(initial.slug ?? '');
  const [date, setDate] = useState(initial.date ?? new Date().toISOString().slice(0, 10));
  const [author, setAuthor] = useState(initial.author ?? 'Arro');
  const [excerpt, setExcerpt] = useState(initial.excerpt ?? '');
  const [hero, setHero] = useState(initial.hero ?? '');
  const [body, setBody] = useState(initial.body ?? '');
  const [hidden, setHidden] = useState<boolean>(initial.hidden ?? false);
  const [pinned, setPinned] = useState<boolean>(initial.pinned ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Auto-derive a slug from the title when creating, until the user edits it.
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  useEffect(() => {
    if (slugTouched) return;
    const auto = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    setSlug(auto);
  }, [title, slugTouched]);

  const slugError = useMemo(() => {
    if (!slug) return null;
    return validateSlug(slug, reservedSlugs);
  }, [slug, reservedSlugs]);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (busy) return;
      if (!title.trim()) { setErr('Title is required.'); return; }
      if (!body.trim()) { setErr('Body is required.'); return; }
      const slugMsg = validateSlug(slug, reservedSlugs);
      if (slugMsg) { setErr(slugMsg); return; }
      setBusy(true);
      setErr(null);
      try {
        await upsertChronicle(
          ownerUid,
          {
            title: title.trim(),
            slug: slug.trim().toLowerCase(),
            date,
            author: author.trim() || 'Arro',
            excerpt: excerpt.trim(),
            hero: hero.trim(),
            body,
            hidden,
            pinned,
          },
          mode === 'create',
        );
        onClose();
      } catch (e2) {
        setErr(e2 instanceof Error ? e2.message : 'Save failed.');
      } finally {
        setBusy(false);
      }
    },
    [busy, title, body, slug, reservedSlugs, ownerUid, date, author, excerpt, hero, hidden, pinned, mode, onClose],
  );

  return (
    <div style={editorBackdrop} role="dialog" aria-modal="true" aria-label="Chronicle editor">
      <form onSubmit={submit} style={editorPanel}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={kicker}>{mode === 'create' ? 'NEW CHRONICLE' : 'EDIT CHRONICLE'}</div>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="Close">×</button>
        </div>

        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="When the mist arrives"
            maxLength={140}
            style={input}
            required
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
          <Field label="Slug" hint={initial.slug ? 'Cannot be changed once published.' : '/chronicles/your-slug'}>
            <input
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder="when-the-mist-arrives"
              maxLength={61}
              style={input}
              disabled={!!initial.slug}
              required
            />
            {slugError && <div style={fieldError}>{slugError}</div>}
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={input}
              required
            />
          </Field>
          <Field label="Author">
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={60}
              style={input}
            />
          </Field>
        </div>

        <Field label="Excerpt" hint="One-sentence preview shown on the index.">
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            maxLength={240}
            rows={2}
            style={{ ...input, resize: 'vertical' as const }}
          />
        </Field>

        <Field label="Hero image URL" hint="Optional. Currently unused by the reader; reserved for future cover art.">
          <input
            value={hero}
            onChange={(e) => setHero(e.target.value)}
            placeholder="https://…"
            style={input}
          />
        </Field>

        <Field label="Body (Markdown)" hint="Standard Markdown + GFM tables. No MDX components.">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            style={{ ...input, resize: 'vertical' as const, fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace', fontSize: 13.5 }}
            required
          />
        </Field>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <label style={checkboxRow}>
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            <span>Pinned (surfaces at the top of the index)</span>
          </label>
          <label style={checkboxRow}>
            <input
              type="checkbox"
              checked={hidden}
              onChange={(e) => setHidden(e.target.checked)}
            />
            <span>Hidden from the public index and reader</span>
          </label>
        </div>

        {err && <div style={errorText}>{err}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={secondaryBtn}>cancel</button>
          <button
            type="submit"
            disabled={busy || !!slugError}
            style={{ ...primaryBtn, opacity: (busy || !!slugError) ? 0.55 : 1 }}
          >
            {busy ? 'binding…' : mode === 'create' ? 'publish' : 'save'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 10.5, letterSpacing: '0.24em', opacity: 0.55 }}>
        {label.toUpperCase()}
      </div>
      {children}
      {hint && <div style={{ fontSize: 11, opacity: 0.45 }}>{hint}</div>}
    </div>
  );
}

function RecentComments() {
  const [rows, setRows] = useState<CommentRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useMemo(
    () => async () => {
      if (!db) return;
      try {
        const snap = await getDocs(
          query(collectionGroup(db, 'comments'), orderBy('createdAt', 'desc'), limit(25)),
        );
        const list: CommentRow[] = snap.docs.map((d) => {
          const data = d.data() as Omit<CommentRow, 'id' | 'slug'>;
          const slug = d.ref.parent.parent?.id ?? '?';
          return { id: d.id, slug, ...data };
        });
        setRows(list);
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load comments.');
      }
    },
    [],
  );

  useEffect(() => { load(); }, [load]);

  const removeComment = async (r: CommentRow) => {
    if (!db) return;
    if (!confirm(`Remove this whisper from "${r.displayName}"?`)) return;
    setBusy(r.id);
    try {
      await deleteDoc(doc(db, 'posts', r.slug, 'comments', r.id));
      setRows((cur) => cur?.filter((c) => c.id !== r.id) ?? null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not remove.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section style={{ marginTop: 36, marginBottom: 80 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div style={sectionLabel}>RECENT WHISPERS</div>
        <button type="button" onClick={() => load()} style={refreshBtn}>
          refresh
        </button>
      </div>
      {err && <p style={errorText}>{err}</p>}
      {!rows ? (
        <p style={muted}>Loading whispers…</p>
      ) : rows.length === 0 ? (
        <p style={muted}>No whispers yet.</p>
      ) : (
        <ul style={list}>
          {rows.map((r) => (
            <li key={r.id} style={listItem}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                <span style={{ fontWeight: 500 }}>{r.displayName || 'anonymous'}</span>
                <span style={{ fontSize: 11, opacity: 0.5 }}>
                  on <a href={`/chronicles/${r.slug}`} style={link}>{r.slug}</a>
                </span>
                <span style={{ fontSize: 11, opacity: 0.45 }}>
                  {r.createdAt?.toDate?.().toLocaleString() ?? '—'}
                </span>
                <button
                  type="button"
                  onClick={() => removeComment(r)}
                  disabled={busy === r.id}
                  style={deleteBtn}
                >
                  {busy === r.id ? 'removing…' : 'remove'}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, opacity: 0.88, whiteSpace: 'pre-wrap' }}>
                {r.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const page: CSSProperties = {
  position: 'relative',
  zIndex: 30,
  minHeight: '100vh',
  background: 'rgba(8, 10, 22, 0.78)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  color: 'rgba(240, 244, 255, 0.92)',
  fontFamily: 'Inter, system-ui, sans-serif',
  padding: '120px 24px 80px',
};
const container: CSSProperties = { maxWidth: 920, margin: '0 auto' };
const kicker: CSSProperties = { fontSize: 10.5, letterSpacing: '0.36em', opacity: 0.55 };
const heading: CSSProperties = {
  margin: '8px 0 0',
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontWeight: 400,
  fontSize: 44,
  lineHeight: 1.1,
  letterSpacing: '0.005em',
};
const sectionLabel: CSSProperties = {
  fontSize: 10.5, letterSpacing: '0.32em', opacity: 0.5,
};
const tileGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 12,
};
const tile: CSSProperties = {
  padding: '18px 18px 20px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.03)',
};
const tileLabel: CSSProperties = {
  fontSize: 10.5, letterSpacing: '0.28em', opacity: 0.55, marginBottom: 10,
};
const tileValue: CSSProperties = {
  fontSize: 28, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em',
};
const tableWrap: CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  overflow: 'hidden',
};
const table: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 };
const th: CSSProperties = {
  textAlign: 'left', fontWeight: 500, padding: '12px 16px',
  fontSize: 11, letterSpacing: '0.22em', opacity: 0.55,
  background: 'rgba(255,255,255,0.03)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};
const td: CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  verticalAlign: 'top',
};
const tdSub: CSSProperties = { fontSize: 11, opacity: 0.5, marginTop: 2 };
const link: CSSProperties = { color: 'rgba(190, 210, 255, 0.94)', textDecoration: 'none' };
const list: CSSProperties = { listStyle: 'none', padding: 0, margin: 0 };
const listItem: CSSProperties = {
  padding: '14px 0',
  borderTop: '1px solid rgba(255,255,255,0.06)',
};
const muted: CSSProperties = { opacity: 0.6, fontSize: 13 };
const errorText: CSSProperties = { fontSize: 12, color: 'rgba(255, 170, 170, 0.92)' };

const primaryBtn: CSSProperties = {
  padding: '7px 14px',
  borderRadius: 999,
  border: '1px solid rgba(200, 220, 255, 0.25)',
  background: 'linear-gradient(180deg, rgba(180, 200, 255, 0.14), rgba(120, 140, 220, 0.10))',
  color: 'rgba(240, 244, 255, 0.96)',
  fontSize: 11,
  letterSpacing: '0.20em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};
const secondaryBtn: CSSProperties = {
  ...primaryBtn,
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.18)',
};
const tinyBtn: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'rgba(190, 210, 255, 0.85)',
  fontSize: 11,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  padding: 0,
};
const tinyDanger: CSSProperties = { ...tinyBtn, color: 'rgba(255,170,170,0.78)' };
const deleteBtn: CSSProperties = {
  marginLeft: 'auto',
  background: 'transparent',
  border: 'none',
  color: 'rgba(255,170,170,0.78)',
  fontSize: 11,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  padding: 0,
};
const refreshBtn: CSSProperties = { ...tinyBtn };
const closeBtn: CSSProperties = {
  marginLeft: 'auto',
  background: 'transparent',
  border: 'none',
  color: 'rgba(255,255,255,0.6)',
  fontSize: 24,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
};
const mdxBadge: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 10.5,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  background: 'rgba(180, 210, 255, 0.10)',
  color: 'rgba(190, 220, 255, 0.92)',
  border: '1px solid rgba(180, 210, 255, 0.18)',
};
const fsBadge: CSSProperties = {
  ...mdxBadge,
  background: 'rgba(255, 220, 160, 0.08)',
  color: 'rgba(255, 230, 180, 0.92)',
  border: '1px solid rgba(255, 220, 160, 0.18)',
};
const pinBadge: CSSProperties = {
  marginLeft: 8,
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  background: 'rgba(255, 220, 160, 0.10)',
  color: 'rgba(255, 230, 180, 0.92)',
  border: '1px solid rgba(255, 220, 160, 0.22)',
};
const hiddenBadge: CSSProperties = {
  marginLeft: 8,
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  background: 'rgba(255,170,170,0.08)',
  color: 'rgba(255,170,170,0.8)',
  border: '1px solid rgba(255,170,170,0.20)',
};

const editorBackdrop: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 10001,
  background: 'rgba(4, 6, 14, 0.78)',
  backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: '60px 24px',
  overflowY: 'auto',
};
const editorPanel: CSSProperties = {
  width: '100%',
  maxWidth: 720,
  padding: '28px 28px 24px',
  borderRadius: 16,
  background: 'linear-gradient(180deg, rgba(28,34,56,0.92) 0%, rgba(16,20,38,0.94) 100%)',
  border: '1px solid rgba(180, 200, 255, 0.16)',
  boxShadow: '0 30px 90px -22px rgba(80, 110, 220, 0.38)',
  color: 'rgba(240, 244, 255, 0.94)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};
const input: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(255,255,255,0.96)',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};
const fieldError: CSSProperties = {
  fontSize: 11.5, color: 'rgba(255,170,170,0.92)',
};
const checkboxRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 13,
  opacity: 0.85,
  cursor: 'pointer',
};
