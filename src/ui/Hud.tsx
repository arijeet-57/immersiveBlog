import type { CSSProperties } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useIsOwner } from '../auth/owner';
import ThemeSwitcher from './ThemeSwitcher';

const brandWrap: CSSProperties = {
  position: 'fixed',
  top: 20,
  left: 24,
  zIndex: 20,
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontFamily: 'Inter, system-ui, sans-serif',
  color: 'rgba(255,255,255,0.88)',
  textDecoration: 'none',
};

const dot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background:
    'radial-gradient(circle at 30% 30%, #aee4ff, #4da0ff 55%, #1a3a8a 100%)',
  boxShadow: '0 0 12px rgba(120, 180, 255, 0.7)',
};

const navWrap: CSSProperties = {
  position: 'fixed',
  top: 20,
  right: 24,
  zIndex: 20,
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 26,
  fontFamily: 'Inter, system-ui, sans-serif',
  color: 'rgba(255,255,255,0.88)',
  textShadow: '0 1px 4px rgba(0, 0, 0, 0.55)',
};

const linkBase: CSSProperties = {
  color: 'rgba(255,255,255,0.78)',
  textDecoration: 'none',
  fontSize: 13,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  transition: 'color 160ms ease',
};

const linkActive: CSSProperties = {
  color: '#fff',
};

const signOutBtn: CSSProperties = {
  ...linkBase,
  background: 'transparent',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
};

const avatar: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  marginLeft: 6,
  border: '1px solid rgba(255,255,255,0.22)',
  objectFit: 'cover',
  background: 'rgba(255,255,255,0.06)',
};

const ITEMS = [
  { to: '/chronicles', label: 'Chronicles' },
  { to: '/sanctuary',  label: 'Sanctuary' },
  { to: '/whispers',   label: 'Whispers' },
];

export default function Hud() {
  const { user, signOut } = useAuth();
  const isOwner = useIsOwner();

  return (
    <>
      <Link to="/" style={brandWrap}>
        <span style={dot} />
        <span style={{ fontSize: 13, letterSpacing: '0.22em' }}>ETHEREAL VALLEY</span>
      </Link>

      <nav style={navWrap} aria-label="Primary">
        <ThemeSwitcher />
        {ITEMS.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            style={({ isActive }) => ({
              ...linkBase,
              ...(isActive ? linkActive : null),
            })}
          >
            {it.label.toUpperCase()}
          </NavLink>
        ))}
        {isOwner && (
          <NavLink
            to="/dashboard"
            style={({ isActive }) => ({
              ...linkBase,
              ...(isActive ? linkActive : null),
              color: isActive ? '#fff' : 'rgba(190, 210, 255, 0.92)',
            })}
            title="Maintainer dashboard"
          >
            DASHBOARD
          </NavLink>
        )}
        {user && (
          <>
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'User'}
                style={avatar}
                referrerPolicy="no-referrer"
              />
            ) : (
              <span
                style={{
                  ...avatar,
                  display: 'inline-grid',
                  placeItems: 'center',
                  fontSize: 11,
                  letterSpacing: 0,
                  color: 'rgba(255,255,255,0.9)',
                }}
                aria-hidden
              >
                {(user.displayName ?? user.email ?? '·')[0]?.toUpperCase()}
              </span>
            )}
            <button
              type="button"
              onClick={() => signOut()}
              style={signOutBtn}
            >
              SIGN OUT
            </button>
          </>
        )}
      </nav>
    </>
  );
}
