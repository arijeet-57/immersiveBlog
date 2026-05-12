import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { routeToPanel } from '../ui/panels/registry';
import { scrollToProgress } from '../providers/lenisInstance';

/**
 * Reacts to route changes. On a named-route load:
 *   - sets pinnedPanelId
 *   - scrolls page to that panel's peak (immediate on cold load, smooth on
 *     subsequent client-side navigation)
 * On `/`: clears the pinned panel.
 */
export default function RouteSync() {
  const { pathname } = useLocation();
  const isColdLoad = useRef(true);

  useEffect(() => {
    const setPinned = useAppStore.getState().setPinnedPanel;
    const setActiveRoute = useAppStore.getState().setActiveRoute;
    setActiveRoute(pathname);

    const spec = routeToPanel(pathname);
    if (spec) {
      setPinned(spec.id);
      // Cold-load deep-link: seed the store synchronously so the camera's
      // first frame is already on-target. The DOM scroll is then aligned via
      // Lenis on the next rAF (with immediate:true so there's no fly-through).
      if (isColdLoad.current) {
        useAppStore.getState().setScrollProgress(spec.range[1]);
      }
      requestAnimationFrame(() => {
        scrollToProgress(spec.range[1], { immediate: isColdLoad.current });
      });
    } else {
      setPinned(null);
    }
    isColdLoad.current = false;
  }, [pathname]);

  return null;
}
