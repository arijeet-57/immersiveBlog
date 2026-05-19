import type { User } from 'firebase/auth';
import { useAuth } from './AuthProvider';

// Single-owner model. For a one-maintainer site this is the right amount of
// auth — anything more (custom claims via Admin SDK, role docs) is overkill.
// The same string is hardcoded into firestore.rules so the client check and
// the server check can never drift.
export const OWNER_EMAIL = 'blakelabs57@gmail.com';

export function isOwner(user: User | null): boolean {
  if (!user || !user.email) return false;
  // emailVerified guards against a provider returning an unverified address.
  // Google sign-in returns verified emails; this matters for GitHub.
  return user.email.toLowerCase() === OWNER_EMAIL && user.emailVerified;
}

export function useIsOwner(): boolean {
  const { user } = useAuth();
  return isOwner(user);
}
