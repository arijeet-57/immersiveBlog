import type { CSSProperties } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import GlassPanel from '../ui/GlassPanel';
import OverlayControls from '../ui/OverlayControls';
import SignInCard from '../ui/SignInCard';
import { useAuth } from '../auth/AuthProvider';

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 30,
  display: 'grid',
  placeItems: 'center',
  padding: '88px 24px 32px',
  pointerEvents: 'auto',
  background:
    'radial-gradient(ellipse at center, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.55) 100%)',
};

const panelStyle: CSSProperties = {
  width: 'min(420px, 100%)',
  padding: '28px 28px 26px',
};

export default function Sanctuary() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Sanctuary · Ethereal Valley</title>
        <meta name="description" content="A private room beneath the canopy." />
      </Helmet>
      <div
        style={overlay}
        onClick={() => navigate('/')}
        role="dialog"
        aria-modal="true"
        aria-label="Sanctuary"
      >
        <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, 100%)' }}>
          <GlassPanel style={panelStyle}>
            <OverlayControls />

            {loading ? (
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: '0.22em',
                  opacity: 0.6,
                  textAlign: 'center',
                  padding: '40px 0',
                }}
              >
                CHECKING THE GATE…
              </div>
            ) : user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.28em',
                    opacity: 0.55,
                    marginBottom: 4,
                  }}
                >
                  SANCTUARY · WELCOME
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt=""
                      referrerPolicy="no-referrer"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        border: '1px solid rgba(255,255,255,0.22)',
                        objectFit: 'cover',
                      }}
                    />
                  )}
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>
                      {user.displayName ?? user.email ?? 'Friend'}
                    </div>
                    {user.email && (
                      <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 2 }}>
                        {user.email}
                      </div>
                    )}
                  </div>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.6, opacity: 0.85 }}>
                  You're inside. Notes and journals for the trusted few will appear here in
                  time — until then, take a quiet moment beneath the canopy.
                </p>
              </div>
            ) : (
              <SignInCard
                title="SANCTUARY"
                subtitle="A private room beneath the canopy. Sign in to enter — your presence stays between you and the valley."
              />
            )}
          </GlassPanel>
        </div>
      </div>
    </>
  );
}
