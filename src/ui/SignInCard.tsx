import type { CSSProperties } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { firebaseConfigured } from '../auth/firebase';

const btn: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(255,255,255,0.94)',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 14,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  transition: 'background 160ms ease, border-color 160ms ease',
};

function Icon({ kind }: { kind: 'google' | 'github' }) {
  const common: CSSProperties = { width: 18, height: 18, flexShrink: 0 };
  if (kind === 'google') {
    return (
      <svg viewBox="0 0 18 18" style={common} aria-hidden>
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84A4.14 4.14 0 0 1 12 13.55v2.3h2.9c1.7-1.56 2.74-3.86 2.74-6.66z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.9-2.3c-.8.54-1.83.86-3.06.86A5.31 5.31 0 0 1 4.04 10.7H1.06v2.37A9 9 0 0 0 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M4.04 10.7a5.4 5.4 0 0 1 0-3.42V4.91H1.06A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.08-2.36z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 1.06 4.91l2.98 2.37A5.31 5.31 0 0 1 9 3.58z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" style={common} aria-hidden>
      <path
        fill="currentColor"
        d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.78 8.2 11.36.6.11.82-.26.82-.58v-2.04c-3.34.72-4.04-1.6-4.04-1.6-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.72.08-.72 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.92 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.6-2.8 5.62-5.47 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z"
      />
    </svg>
  );
}

export default function SignInCard({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { signInGoogle, signInGithub, error, loading } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.28em',
            opacity: 0.55,
            marginBottom: 8,
          }}
        >
          {title ?? 'SIGN IN'}
        </div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, opacity: 0.82 }}>
          {subtitle ?? 'Continue with a provider to enter.'}
        </p>
      </div>

      {!firebaseConfigured && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(255, 200, 100, 0.08)',
            border: '1px solid rgba(255, 200, 100, 0.25)',
            fontSize: 12,
            lineHeight: 1.5,
            opacity: 0.9,
          }}
        >
          Auth is unavailable — Firebase env vars aren't configured. See <code>.env.example</code>.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          style={btn}
          onClick={() => signInGoogle()}
          disabled={loading || !firebaseConfigured}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
          }}
        >
          <Icon kind="google" />
          <span>Continue with Google</span>
        </button>
        <button
          type="button"
          style={btn}
          onClick={() => signInGithub()}
          disabled={loading || !firebaseConfigured}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
          }}
        >
          <Icon kind="github" />
          <span>Continue with GitHub</span>
        </button>
      </div>

      {error && (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: 'rgba(255, 170, 170, 0.95)',
            padding: '8px 10px',
            background: 'rgba(255, 80, 80, 0.08)',
            border: '1px solid rgba(255, 80, 80, 0.25)',
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
