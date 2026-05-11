import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';

/**
 * Subscribes (without re-rendering on scroll) to pinnedPanelId and returns
 * whether this panel is pinned, plus a close callback.
 */
export function usePinClose(id: string) {
  const navigate = useNavigate();
  const [pinned, setPinned] = useState(
    () => useAppStore.getState().pinnedPanelId === id
  );

  useEffect(() => {
    return useAppStore.subscribe(
      (s) => s.pinnedPanelId,
      (v) => setPinned(v === id)
    );
  }, [id]);

  return {
    pinned,
    close: () => navigate('/'),
  };
}
