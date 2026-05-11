import GlassPanel from '../GlassPanel';

export default function AboutPanel() {
  return (
    <GlassPanel style={{ padding: '20px 24px', maxWidth: 360 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.28em', opacity: 0.55, marginBottom: 8 }}>
        WHERE YOU ARE
      </div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, opacity: 0.82 }}>
        This is a quiet field at the edge of nowhere — a place for slow thoughts, longer reading, and
        whatever else the night carries. The valley keeps everything it is given.
      </p>
    </GlassPanel>
  );
}
