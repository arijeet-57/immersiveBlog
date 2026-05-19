import type { CSSProperties } from 'react';

const wrap: CSSProperties = {
  position: 'fixed',
  bottom: 22,
  left: 24,
  zIndex: 20,
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  color: 'rgba(255, 255, 255, 0.72)',
  filter: 'drop-shadow(0 1px 4px rgba(0, 0, 0, 0.55))',
};

const linkBase: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 22,
  height: 22,
  color: 'inherit',
  transition: 'color 160ms ease, transform 160ms ease',
};

function Portfolio() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
      <path d="M3 12h18" />
    </svg>
  );
}

function Github() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.78 8.2 11.36.6.11.82-.26.82-.58v-2.04c-3.34.72-4.04-1.6-4.04-1.6-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.72.08-.72 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.92 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.6-2.8 5.62-5.47 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}

function Instagram() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

const LINKS = [
  { href: 'https://portfolio-arijeet.vercel.app/', label: 'Portfolio', Icon: Portfolio },
  { href: 'https://github.com/arijeet-57',          label: 'GitHub',    Icon: Github },
  { href: 'https://www.instagram.com/ar_ro58/',     label: 'Instagram', Icon: Instagram },
];

export default function SocialLinks() {
  return (
    <div style={wrap} aria-label="Elsewhere">
      {LINKS.map(({ href, label, Icon }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          style={linkBase}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
            (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = 'inherit';
            (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
          }}
        >
          <Icon />
        </a>
      ))}
    </div>
  );
}
