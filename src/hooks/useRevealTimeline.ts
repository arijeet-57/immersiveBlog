import { useEffect, type MutableRefObject } from 'react';
import { useAppStore } from '../store/appStore';
import { PANELS, PIN_UNPIN_TOLERANCE, panelById } from '../ui/panels/registry';
import { entryOffset } from '../ui/panels/anchors';
import { scrollToProgress } from '../providers/lenisInstance';

interface RefMap {
  [panelId: string]: MutableRefObject<HTMLDivElement | null>;
}

function smoothstep(a: number, b: number, x: number): number {
  if (b <= a) return x < a ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Computes 0..1 visibility for a panel given scroll progress and its
 * [start, peak, end] range. Holds at 1 across the plateau, fades in/out
 * smoothly at the edges.
 */
function visibilityForRange(
  scroll: number,
  start: number,
  peak: number,
  end: number
): number {
  // Fade-in band: [start, peak]; hold until end - fadeOutWidth; fade-out band: [end - fadeOutWidth, end]
  const fadeOutWidth = Math.min(0.05, (end - peak) * 0.5);
  if (scroll <= start) return 0;
  if (scroll >= end) return 0;
  if (scroll <= peak) return smoothstep(start, peak, scroll);
  if (scroll >= end - fadeOutWidth) return 1 - smoothstep(end - fadeOutWidth, end, scroll);
  return 1;
}

export function useRevealTimeline(
  refs: RefMap,
  /**
   * Called when an auto-unpin should reset the URL back to "/". The caller
   * passes a navigate callback that goes through React Router so Router's
   * internal location stays in sync with the URL.
   */
  onAutoUnpin?: () => void
) {
  useEffect(() => {
    let lastScroll = useAppStore.getState().scrollProgress;
    let lastPinned = useAppStore.getState().pinnedPanelId;

    function apply() {
      const scroll = lastScroll;
      const pinned = lastPinned;

      for (const spec of PANELS) {
        const ref = refs[spec.id]?.current;
        if (!ref) continue;
        const isPinned = pinned === spec.id;
        const vis = isPinned ? 1 : visibilityForRange(scroll, ...spec.range);
        const off = entryOffset(spec.anchor);
        // Slide-in: at vis=0 panel is offset; at vis=1 panel is centered.
        const tx = (1 - vis) * off.x;
        const ty = (1 - vis) * off.y;
        ref.style.opacity = String(vis);
        ref.style.transform = `translate(${tx}px, ${ty}px)`;
        ref.style.pointerEvents = vis > 0.1 ? 'auto' : 'none';
      }

      // Auto-unpin if user has scrolled more than the tolerance beyond the
      // pinned panel's range in either direction.
      if (pinned) {
        const spec = panelById(pinned);
        if (spec) {
          const [start, , end] = spec.range;
          if (scroll < start - PIN_UNPIN_TOLERANCE || scroll > end + PIN_UNPIN_TOLERANCE) {
            useAppStore.getState().setPinnedPanel(null);
            // Caller routes through React Router to reset URL → keeps
            // Router's location in sync with the address bar.
            if (window.location.pathname !== '/') {
              onAutoUnpin?.();
            }
          }
        }
      }
    }

    // Initial paint.
    apply();

    const unsubScroll = useAppStore.subscribe(
      (s) => s.scrollProgress,
      (v) => {
        lastScroll = v;
        apply();
      }
    );
    const unsubPinned = useAppStore.subscribe(
      (s) => s.pinnedPanelId,
      (v) => {
        lastPinned = v;
        apply();
      }
    );

    return () => {
      unsubScroll();
      unsubPinned();
    };
  }, [refs, onAutoUnpin]);
}

/** Imperative scroll-to-panel for route deep links. */
export function scrollToPanel(panelId: string, immediate = false) {
  const spec = panelById(panelId);
  if (!spec) return;
  scrollToProgress(spec.range[1], { immediate });
}
