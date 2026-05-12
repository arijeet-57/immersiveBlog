import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { panelById } from './panels/registry';

// Subtle "scroll to continue exploring" cue shown when the user lands on a
// pinned deep-link route. Disappears the moment the user scrolls more than
// a hair away from the pinned panel's peak, or when they unpin manually.
export default function PinnedScrollHint() {
  const pinned = useAppStore((s) => s.pinnedPanelId);
  const [anchorScroll, setAnchorScroll] = useState<number | null>(null);

  useEffect(() => {
    if (!pinned) {
      setAnchorScroll(null);
      return;
    }
    const spec = panelById(pinned);
    if (!spec) return;
    setAnchorScroll(spec.range[1]);
  }, [pinned]);

  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(false);
    if (anchorScroll == null) return;
    return useAppStore.subscribe(
      (s) => s.scrollProgress,
      (v) => {
        if (Math.abs(v - anchorScroll) > 0.005) setHidden(true);
      }
    );
  }, [anchorScroll]);

  if (!pinned || hidden) return null;
  return <div className="scroll-hint">Scroll to continue exploring</div>;
}
