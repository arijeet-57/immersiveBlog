import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../auth/firebase';
import { useIsOwner } from '../auth/owner';
import { posts as mdxPosts, type Post as MdxPost } from './posts';

// Hybrid model:
//   - MDX files in /content/chronicles/*.mdx → static, code-rendered fallback.
//   - chronicles/{slug} in Firestore        → editable copy. When present
//                                              for a given slug, it wins.
//
// "Promote-on-action": the first time the owner edits/hides/pins an MDX-only
// post, we create a Firestore doc with the same slug and a copy of the raw
// Markdown body. From then on the dashboard manages it like any other.

export interface FirestoreChronicle {
  title: string;
  slug: string;
  date: string;
  author: string;
  excerpt: string;
  hero: string;
  body: string;
  hidden: boolean;
  pinned: boolean;
  ownerUid: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type ChronicleSource = 'mdx' | 'firestore' | 'mdx+firestore';

export interface ChronicleListItem {
  source: ChronicleSource;
  slug: string;
  title: string;
  date: string;
  author: string;
  excerpt: string;
  hero: string;
  hidden: boolean;
  pinned: boolean;
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,60}$/;

export function validateSlug(raw: string, reservedSlugs: Set<string>): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return 'Slug is required.';
  if (!SLUG_RE.test(v))
    return 'Use 2–61 chars: lowercase letters, numbers, hyphens (no leading hyphen).';
  if (reservedSlugs.has(v)) return 'That slug already exists.';
  return null;
}

// Subscribes to the entire `chronicles` collection (small N). Public users
// only see non-hidden; owners see everything. Falls back to one-shot read if
// the subscription errors (e.g. rules not yet deployed).
function useFirestoreChronicles(owner: boolean): FirestoreChronicle[] | null {
  const [items, setItems] = useState<FirestoreChronicle[] | null>(null);

  useEffect(() => {
    if (!db) { setItems([]); return; }
    // Non-owners must filter to non-hidden docs so the per-doc read rule
    // (`hidden == false || isOwner()`) passes for every result — Firestore
    // refuses a list query if any returned doc would violate rules.
    const q = owner
      ? query(collection(db, 'chronicles'))
      : query(collection(db, 'chronicles'), where('hidden', '==', false));
    const unsub = onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((d) => d.data() as FirestoreChronicle)),
      () => setItems([]),
    );
    return unsub;
  }, [owner]);

  return items;
}

// One-shot fetch of a single Firestore chronicle by slug.
export function useFirestoreChronicle(slug: string | undefined) {
  const [chronicle, setChronicle] = useState<FirestoreChronicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!db || !slug) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const snap = await getDoc(doc(db!, 'chronicles', slug));
        if (cancelled) return;
        if (!snap.exists()) { setNotFound(true); setChronicle(null); }
        else setChronicle(snap.data() as FirestoreChronicle);
      } catch {
        if (!cancelled) { setNotFound(true); setChronicle(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  return { chronicle, loading, notFound };
}

// Public-facing list. MDX is the seed; Firestore overrides by slug.
// Pinned items sort first, then date descending.
export function useChronicleList(): {
  items: ChronicleListItem[];
  loading: boolean;
  // Helpers exposed for the dashboard so it can act on any row uniformly.
  getMdx: (slug: string) => MdxPost | undefined;
  getFirestore: (slug: string) => FirestoreChronicle | undefined;
} {
  const owner = useIsOwner();
  const firestoreItems = useFirestoreChronicles(owner);

  const fsBySlug = useMemo(() => {
    const m = new Map<string, FirestoreChronicle>();
    for (const c of firestoreItems ?? []) m.set(c.slug, c);
    return m;
  }, [firestoreItems]);

  const mdxBySlug = useMemo(() => {
    const m = new Map<string, MdxPost>();
    for (const p of mdxPosts) m.set(p.slug, p);
    return m;
  }, []);

  const items = useMemo<ChronicleListItem[]>(() => {
    const slugs = new Set<string>();
    for (const p of mdxPosts) slugs.add(p.slug);
    for (const c of firestoreItems ?? []) slugs.add(c.slug);

    const out: ChronicleListItem[] = [];
    for (const slug of slugs) {
      const mdx = mdxBySlug.get(slug);
      const fs = fsBySlug.get(slug);
      // Non-owners must respect the Firestore hidden flag.
      if (fs?.hidden && !owner) continue;
      if (fs) {
        out.push({
          source: mdx ? 'mdx+firestore' : 'firestore',
          slug,
          title: fs.title,
          date: fs.date,
          author: fs.author,
          excerpt: fs.excerpt,
          hero: fs.hero,
          hidden: fs.hidden,
          pinned: fs.pinned,
        });
      } else if (mdx) {
        out.push({
          source: 'mdx',
          slug,
          title: mdx.title,
          date: mdx.date,
          author: mdx.author,
          excerpt: mdx.excerpt,
          hero: mdx.hero,
          hidden: false,
          pinned: false,
        });
      }
    }
    return out.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.date < b.date ? 1 : -1;
    });
  }, [firestoreItems, fsBySlug, mdxBySlug, owner]);

  return {
    items,
    loading: firestoreItems === null,
    getMdx: (slug) => mdxBySlug.get(slug),
    getFirestore: (slug) => fsBySlug.get(slug),
  };
}

// Build a starting payload for the editor — either the existing Firestore doc
// or an MDX post hydrated into the same shape (with hidden/pinned defaults).
export function buildEditorSeed(
  mdx: MdxPost | undefined,
  fs: FirestoreChronicle | undefined,
): Partial<FirestoreChronicle> {
  if (fs) return fs;
  if (mdx) {
    // MDX bodies live as compiled JSX and can't be read back as raw Markdown
    // at runtime (the MDX plugin runs `enforce: 'pre'`). Seed the editor with
    // a placeholder so the owner pastes the original prose from their editor.
    return {
      title: mdx.title,
      slug: mdx.slug,
      date: mdx.date,
      author: mdx.author,
      excerpt: mdx.excerpt,
      hero: mdx.hero,
      body: `# ${mdx.title}\n\n${mdx.excerpt}\n\n_Paste the original body from content/chronicles/${mdx.slug}.mdx_`,
      hidden: false,
      pinned: false,
    };
  }
  return {};
}

export async function upsertChronicle(
  ownerUid: string,
  data: Omit<FirestoreChronicle, 'ownerUid' | 'createdAt' | 'updatedAt'>,
  isCreate: boolean,
): Promise<void> {
  if (!db) throw new Error('Firestore not configured.');
  const ref = doc(db, 'chronicles', data.slug);
  if (isCreate) {
    await setDoc(ref, {
      ...data,
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(
      ref,
      {
        title: data.title,
        slug: data.slug,
        date: data.date,
        author: data.author,
        excerpt: data.excerpt,
        hero: data.hero,
        body: data.body,
        hidden: data.hidden,
        pinned: data.pinned,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

// Promote an MDX-only post into Firestore so it becomes editable. Returns
// the new doc payload. No-op if a Firestore doc for this slug already exists.
export async function promoteMdxToFirestore(
  mdx: MdxPost,
  ownerUid: string,
  overrides: Partial<Pick<FirestoreChronicle, 'hidden' | 'pinned'>> = {},
): Promise<FirestoreChronicle> {
  if (!db) throw new Error('Firestore not configured.');
  const ref = doc(db, 'chronicles', mdx.slug);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data() as FirestoreChronicle;
  const payload: Omit<FirestoreChronicle, 'createdAt' | 'updatedAt'> = {
    title: mdx.title,
    slug: mdx.slug,
    date: mdx.date,
    author: mdx.author,
    excerpt: mdx.excerpt,
    hero: mdx.hero,
    // Empty body on first promotion — the MDX file keeps rendering until the
    // owner explicitly edits and saves a real body via the dashboard.
    body: '',
    hidden: overrides.hidden ?? false,
    pinned: overrides.pinned ?? false,
    ownerUid,
  };
  await setDoc(ref, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // Return value carries null timestamps; callers don't use them right away.
  return { ...payload, createdAt: null, updatedAt: null };
}

export async function deleteChronicle(slug: string): Promise<void> {
  if (!db) throw new Error('Firestore not configured.');
  await deleteDoc(doc(db, 'chronicles', slug));
}

export const mdxSlugs = new Set(mdxPosts.map((p) => p.slug));
