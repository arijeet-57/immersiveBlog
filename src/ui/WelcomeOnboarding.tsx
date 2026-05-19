import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useProfile, validateUsername } from '../auth/ProfileProvider';

export default function WelcomeOnboarding() {
  const { user, signOut } = useAuth();
  const { needsOnboarding, claimUsername } = useProfile();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Seed the field with the provider's display name (sanitised).
  useEffect(() => {
    if (!needsOnboarding || !user?.displayName) return;
    setName((current) => {
      if (current) return current;
      return user.displayName!
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20);
    });
  }, [needsOnboarding, user?.displayName]);

  const lowered = name.trim().toLowerCase();
  const liveValidation = useMemo(
    () => (lowered ? validateUsername(lowered) : null),
    [lowered],
  );

  if (!needsOnboarding) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const invalid = validateUsername(lowered);
    if (invalid) {
      setErr(invalid);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await claimUsername(lowered);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not claim that name.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <style>{keyframes}</style>
      <div style={backdrop} role="dialog" aria-modal="true" aria-label="Welcome to the valley">
        <div style={panel}>
          <div style={glow} aria-hidden />
          <div style={{ position: 'relative' }}>
            <div style={kicker}>WELCOME, TRAVELER</div>
            <h2 style={title}>The valley has been waiting.</h2>
            <p style={subtitle}>
              Mist parts at the river's edge. Fireflies drift up to meet you.
              <br />
              Before you wander deeper — what name shall it remember you by?
            </p>

            <form onSubmit={submit} style={{ marginTop: 22 }}>
              <label style={label} htmlFor="rb-username">
                YOUR NAME IN THE VALLEY
              </label>
              <input
                id="rb-username"
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErr(null);
                }}
                placeholder="moonlit_wanderer"
                maxLength={20}
                autoComplete="off"
                spellCheck={false}
                style={input}
              />
              <div style={hint}>
                {err ? (
                  <span style={{ color: 'rgba(255, 170, 170, 0.92)' }}>{err}</span>
                ) : liveValidation ? (
                  <span style={{ opacity: 0.7 }}>{liveValidation}</span>
                ) : (
                  <span style={{ opacity: 0.5 }}>
                    3–20 characters · lowercase letters, numbers, underscores
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={busy || !lowered || !!liveValidation}
                style={{
                  ...submitBtn,
                  opacity: busy || !lowered || !!liveValidation ? 0.55 : 1,
                  cursor:
                    busy || !lowered || !!liveValidation ? 'not-allowed' : 'pointer',
                }}
              >
                {busy ? 'binding the name…' : 'enter the valley'}
              </button>
            </form>

            <button type="button" onClick={() => signOut()} style={escapeLink}>
              turn back
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const keyframes = `
@keyframes rb-onboarding-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes rb-onboarding-rise {
  from { opacity: 0; transform: translateY(14px) scale(0.985); filter: blur(6px); }
  to   { opacity: 1; transform: translateY(0)    scale(1);     filter: blur(0);   }
}
@keyframes rb-onboarding-drift {
  0%, 100% { transform: translate(-50%, 0)    scale(1);    opacity: 0.55; }
  50%      { transform: translate(-50%, -8px) scale(1.04); opacity: 0.85; }
}
`;

const backdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  background:
    'radial-gradient(ellipse at center, rgba(12, 16, 30, 0.72) 0%, rgba(4, 6, 14, 0.94) 70%)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  animation: 'rb-onboarding-fade 700ms ease-out both',
};

const panel: CSSProperties = {
  position: 'relative',
  maxWidth: 460,
  width: '100%',
  padding: '40px 34px 30px',
  borderRadius: 18,
  background:
    'linear-gradient(180deg, rgba(30, 36, 60, 0.78) 0%, rgba(16, 20, 38, 0.82) 100%)',
  border: '1px solid rgba(180, 200, 255, 0.16)',
  boxShadow:
    '0 30px 90px -22px rgba(80, 110, 220, 0.38), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.05)',
  color: 'rgba(240, 244, 255, 0.94)',
  overflow: 'hidden',
  animation: 'rb-onboarding-rise 900ms cubic-bezier(.2,.8,.2,1) both',
};

const glow: CSSProperties = {
  position: 'absolute',
  top: '-46%',
  left: '50%',
  width: 360,
  height: 360,
  background:
    'radial-gradient(circle, rgba(190, 210, 255, 0.22) 0%, rgba(120, 140, 220, 0.05) 50%, transparent 72%)',
  pointerEvents: 'none',
  animation: 'rb-onboarding-drift 7s ease-in-out infinite',
};

const kicker: CSSProperties = {
  fontSize: 10.5,
  letterSpacing: '0.36em',
  opacity: 0.55,
  marginBottom: 12,
};

const title: CSSProperties = {
  margin: 0,
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontWeight: 400,
  fontSize: 30,
  lineHeight: 1.18,
  letterSpacing: '0.005em',
};

const subtitle: CSSProperties = {
  marginTop: 14,
  marginBottom: 0,
  fontSize: 14,
  lineHeight: 1.7,
  opacity: 0.78,
  fontStyle: 'italic',
};

const label: CSSProperties = {
  display: 'block',
  fontSize: 10.5,
  letterSpacing: '0.28em',
  opacity: 0.55,
  marginBottom: 8,
};

const input: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(255,255,255,0.96)',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 15,
  letterSpacing: '0.02em',
  outline: 'none',
  boxSizing: 'border-box',
};

const hint: CSSProperties = {
  fontSize: 12,
  marginTop: 8,
  minHeight: 18,
  lineHeight: 1.5,
};

const submitBtn: CSSProperties = {
  marginTop: 20,
  width: '100%',
  padding: '13px 16px',
  borderRadius: 999,
  border: '1px solid rgba(200, 220, 255, 0.28)',
  background:
    'linear-gradient(180deg, rgba(180, 200, 255, 0.14), rgba(120, 140, 220, 0.10))',
  color: 'rgba(240, 244, 255, 0.96)',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12.5,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  transition: 'background 200ms ease, border-color 200ms ease',
};

const escapeLink: CSSProperties = {
  display: 'block',
  margin: '20px auto 0',
  background: 'transparent',
  border: 'none',
  color: 'rgba(220, 226, 245, 0.45)',
  fontSize: 11,
  letterSpacing: '0.24em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};
