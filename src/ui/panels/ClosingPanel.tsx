import GlassPanel from '../GlassPanel';

export default function ClosingPanel() {
  return (
    <GlassPanel style={{ padding: '24px 32px', maxWidth: 520, textAlign: 'center' }}>
      <p
        style={{
          margin: 0,
          fontSize: 16,
          fontStyle: 'italic',
          lineHeight: 1.6,
          opacity: 0.88,
        }}
      >
        The valley remembers everything.
      </p>
      <div
        style={{
          marginTop: 22,
          display: 'flex',
          gap: 18,
          justifyContent: 'center',
          fontSize: 11,
          letterSpacing: '0.22em',
          opacity: 0.65,
        }}
      >
        <a href="/rss.xml" style={{ color: 'inherit', textDecoration: 'none' }}>RSS</a>
        <a href="mailto:arro@ethereal.valley" style={{ color: 'inherit', textDecoration: 'none' }}>EMAIL</a>
        <span>© ARRO · 2026</span>
      </div>
    </GlassPanel>
  );
}
