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
  GoogleAuthProvider,
  GithubAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth, firebaseConfigured } from './firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  ready: boolean; // firebase configured AND initial auth state resolved
  signInGoogle: () => Promise<void>;
  signInGithub: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const runProvider = useCallback(
    async (provider: GoogleAuthProvider | GithubAuthProvider) => {
      if (!auth) {
        setError('Sign-in is not available — Firebase is not configured.');
        return;
      }
      setError(null);
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Sign-in failed.';
        setError(msg);
      }
    },
    [],
  );

  const signInGoogle = useCallback(
    () => runProvider(new GoogleAuthProvider()),
    [runProvider],
  );

  const signInGithub = useCallback(
    () => runProvider(new GithubAuthProvider()),
    [runProvider],
  );

  const signOut = useCallback(async () => {
    if (!auth) return;
    setError(null);
    try {
      await fbSignOut(auth);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-out failed.');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      ready: firebaseConfigured && !loading,
      signInGoogle,
      signInGithub,
      signOut,
      error,
      clearError: () => setError(null),
    }),
    [user, loading, signInGoogle, signInGithub, signOut, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
