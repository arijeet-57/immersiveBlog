import GlassPanel from '../GlassPanel';

export default function IntroPanel() {
  return (
    <GlassPanel style={{ padding: '32px 40px', maxWidth: 520, textAlign: 'center' }}>
      <div style={{ fontSize: 12, letterSpacing: '0.32em', opacity: 0.6, marginBottom: 14 }}>
        A NOCTURNAL ARCHIVE
      </div>
      <h1 style={{ margin: 0, fontWeight: 300, fontSize: 44, letterSpacing: '0.02em' }}>
        Ethereal Valley
      </h1>
      <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.6, opacity: 0.78 }}>
        A bioluminescent journey through the long night. Scroll to descend.
      </p>
      <div style={{ marginTop: 24, fontSize: 11, letterSpacing: '0.22em', opacity: 0.55 }}>
        ↓ SCROLL TO BEGIN
      </div>
    </GlassPanel>
  );
}
