import { useMemo, useRef, type MutableRefObject } from 'react';
import { PANELS } from './panels/registry';
import { anchorStyle } from './panels/anchors';
import { useRevealTimeline } from '../hooks/useRevealTimeline';
import IntroPanel from './panels/IntroPanel';
import AboutPanel from './panels/AboutPanel';
import ChroniclesPanel from './panels/ChroniclesPanel';
import FeaturedPostPanel from './panels/FeaturedPostPanel';
import SanctuaryPanel from './panels/SanctuaryPanel';
import WhispersPanel from './panels/WhispersPanel';
import ClosingPanel from './panels/ClosingPanel';

const PANEL_COMPONENTS: Record<string, () => JSX.Element> = {
  intro: IntroPanel,
  about: AboutPanel,
  chronicles: ChroniclesPanel,
  featured: FeaturedPostPanel,
  sanctuary: SanctuaryPanel,
  whispers: WhispersPanel,
  closing: ClosingPanel,
};

export default function RevealLayer() {
  // Stable mutable ref map across renders.
  const refs = useRef<Record<string, MutableRefObject<HTMLDivElement | null>>>({});
  const refMap = useMemo(() => {
    for (const p of PANELS) {
      if (!refs.current[p.id]) {
        refs.current[p.id] = { current: null };
      }
    }
    return refs.current;
  }, []);

  useRevealTimeline(refMap);

  return (
    <div className="reveal-layer">
      {PANELS.map((spec) => {
        const Component = PANEL_COMPONENTS[spec.id];
        return (
          <div key={spec.id} data-panel={spec.id} style={anchorStyle(spec.anchor)}>
            <div
              className="panel-content"
              ref={(el) => {
                refMap[spec.id].current = el;
              }}
              style={{ opacity: 0, transform: 'translate(0, 0)' }}
            >
              <Component />
            </div>
          </div>
        );
      })}
    </div>
  );
}
