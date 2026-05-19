import { useCallback, useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthProvider';
import { useProfile } from './ProfileProvider';

// Data model:
//   posts/{slug}                       — { likeCount }
//   posts/{slug}/likes/{uid}           — empty marker doc; presence = liked
//   posts/{slug}/comments/{commentId}  — { uid, displayName, photoURL, body, createdAt }

export interface Comment {
  id: string;
  uid: string;
  displayName: string;
  photoURL: string | null;
  body: string;
  createdAt: Timestamp | null;
}

export function useLikes(slug: string) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  // Live like count via the post metadata doc.
  useEffect(() => {
    if (!db || !slug) return;
    const ref = doc(db, 'posts', slug);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      setCount(typeof data?.likeCount === 'number' ? data.likeCount : 0);
    });
    return unsub;
  }, [slug]);

  // Does the current user already have a like doc?
  useEffect(() => {
    if (!db || !slug || !user) {
      setLiked(false);
      return;
    }
    const ref = doc(db, 'posts', slug, 'likes', user.uid);
    const unsub = onSnapshot(ref, (snap) => setLiked(snap.exists()));
    return unsub;
  }, [slug, user?.uid]);

  const toggle = useCallback(async () => {
    if (!db || !user || !slug || busy) return;
    setBusy(true);
    try {
      const postRef = doc(db, 'posts', slug);
      const likeRef = doc(db, 'posts', slug, 'likes', user.uid);
      const likeSnap = await getDoc(likeRef);
      const batch = writeBatch(db);
      if (likeSnap.exists()) {
        batch.delete(likeRef);
        batch.set(postRef, { likeCount: increment(-1) }, { merge: true });
      } else {
        batch.set(likeRef, { createdAt: serverTimestamp() });
        batch.set(postRef, { likeCount: increment(1) }, { merge: true });
      }
      await batch.commit();
    } finally {
      setBusy(false);
    }
  }, [slug, user?.uid, busy]);

  return { count, liked, toggle, canLike: !!user && !!db, busy };
}

export function useComments(slug: string) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !slug) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'posts', slug, 'comments'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(
          snap.docs.map((d) => ({
            id: d.id,
            // `serverTimestamps: 'estimate'` fills in pending serverTimestamp()
            // values with the SDK's best local estimate, so a freshly-posted
            // comment appears in the list instantly instead of after the
            // server round-trip resolves its timestamp.
            ...(d.data({ serverTimestamps: 'estimate' }) as Omit<Comment, 'id'>),
          })),
        );
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [slug]);

  const submit = useCallback(
    async (body: string) => {
      if (!db || !user || !slug) return;
      const text = body.trim().slice(0, 2000);
      if (!text) return;
      setPosting(true);
      setError(null);
      try {
        await addDoc(collection(db, 'posts', slug, 'comments'), {
          uid: user.uid,
          // Prefer the chosen valley-name; fall back to provider name only if
          // the user somehow posts before completing onboarding (which the
          // modal prevents in normal flow).
          displayName: profile?.username ?? user.displayName ?? 'Anonymous',
          photoURL: profile?.photoURL ?? user.photoURL ?? null,
          body: text,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to post comment.');
      } finally {
        setPosting(false);
      }
    },
    [slug, user?.uid, user?.displayName, user?.photoURL, profile?.username, profile?.photoURL],
  );

  const remove = useCallback(
    async (commentId: string, authorUid: string) => {
      if (!db || !user || !slug) return;
      // Client-side guard. Real enforcement is in firestore.rules.
      if (user.uid !== authorUid) return;
      await deleteDoc(doc(db, 'posts', slug, 'comments', commentId));
    },
    [slug, user?.uid],
  );

  return {
    comments,
    loading,
    posting,
    error,
    submit,
    remove,
    canPost: !!user && !!db,
  };
}

// One-shot read of likes + comment count for an index/listing view. Avoids
// the per-card live snapshot listeners that useLikes/useComments would set
// up — those are appropriate inside the reader, not on a 5–50 row list.
export function usePostStats(slug: string) {
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!db || !slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const [postSnap, commentsCount] = await Promise.all([
          getDoc(doc(db!, 'posts', slug)),
          getCountFromServer(collection(db!, 'posts', slug, 'comments')),
        ]);
        if (cancelled) return;
        const data = postSnap.data();
        setLikeCount(typeof data?.likeCount === 'number' ? data.likeCount : 0);
        setCommentCount(commentsCount.data().count);
      } catch {
        // Silently degrade — index will show 0/0 if rules or network fail.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { likeCount, commentCount, loading };
}

