import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthProvider';

// Data model:
//   users/{uid}              — { username, displayName, photoURL, providerId, createdAt }
//   usernames/{lowername}    — { uid, createdAt }  ← reservation doc, uniqueness via Firestore rules
//
// Firestore `create` rules only match when the doc does NOT exist, so two
// users racing for the same username will see one win and the other get
// permission-denied — no squatting possible. The username doc is the source
// of truth for uniqueness; the users doc is the source of truth for profile.
//
// localStorage caches the profile keyed by uid so the welcome modal doesn't
// flash on every reload — Firestore subscription writes through on change.

export interface Profile {
  username: string;
  displayName: string;
  photoURL: string | null;
  providerId?: string | null;
}

interface ProfileContextValue {
  profile: Profile | null;
  loading: boolean;
  needsOnboarding: boolean;
  claimUsername: (raw: string) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const cacheKey = (uid: string) => `retroblog.profile.${uid}`;

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const RESERVED = new Set([
  'admin', 'root', 'mod', 'moderator', 'webmaster', 'arro',
  'system', 'support', 'help', 'firebase', 'google', 'github',
  'null', 'undefined', 'anonymous', 'me', 'you', 'staff',
]);

export function validateUsername(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return 'Please choose a name.';
  if (v.startsWith('_')) return 'Cannot begin with an underscore.';
  if (!USERNAME_RE.test(v)) return '3–20 chars · lowercase letters, numbers, underscores.';
  if (RESERVED.has(v)) return 'That name is reserved by the valley.';
  return null;
}

function readCache(uid: string): Profile | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function writeCache(uid: string, p: Profile | null) {
  try {
    if (p) localStorage.setItem(cacheKey(uid), JSON.stringify(p));
    else localStorage.removeItem(cacheKey(uid));
  } catch {
    // Quota or disabled storage — non-fatal, cache is best-effort.
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(!!uid);

  useEffect(() => {
    if (!db || !uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    // Instant hydration from cache — Firestore listener will overwrite.
    const cached = readCache(uid);
    if (cached) {
      setProfile(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const ref = doc(db, 'users', uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Profile;
          setProfile(data);
          writeCache(uid, data);
        } else {
          setProfile(null);
          writeCache(uid, null);
        }
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  const claimUsername = useCallback(
    async (raw: string) => {
      if (!db || !user) throw new Error('Not signed in.');
      const v = raw.trim().toLowerCase();
      const invalid = validateUsername(v);
      if (invalid) throw new Error(invalid);

      const batch = writeBatch(db);
      batch.set(doc(db, 'usernames', v), {
        uid: user.uid,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'users', user.uid), {
        username: v,
        displayName: user.displayName ?? v,
        photoURL: user.photoURL ?? null,
        providerId: user.providerData[0]?.providerId ?? null,
        createdAt: serverTimestamp(),
      });
      try {
        await batch.commit();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not claim that name.';
        // Permission-denied here almost always means the username doc already
        // exists (Firestore create-rules block overwrite). Translate to UX copy.
        if (/permission/i.test(msg)) {
          throw new Error('That name is already taken.');
        }
        throw new Error(msg);
      }
    },
    [user],
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      loading,
      needsOnboarding: !!user && !loading && !profile,
      claimUsername,
    }),
    [profile, loading, user, claimUsername],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within <ProfileProvider>');
  return ctx;
}
