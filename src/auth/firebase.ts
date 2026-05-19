import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  config.apiKey && config.projectId && config.authDomain && config.appId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseConfigured) {
  app = getApps()[0] ?? initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
} else if (typeof window !== 'undefined') {
  // Surfaced once on the console so the developer knows why auth is inert.
  console.warn(
    '[auth] Firebase env vars missing — Sanctuary/Whispers will run in disabled mode. Set VITE_FIREBASE_* in .env.local to enable.',
  );
}

export { app, auth, db };
