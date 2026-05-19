import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type Theme = 'dawn' | 'day' | 'night';

interface AppState {
  scrollProgress: number;
  pinnedPanelId: string | null;
  activeRoute: string;
  theme: Theme;
  setScrollProgress: (n: number) => void;
  setPinnedPanel: (id: string | null) => void;
  setActiveRoute: (r: string) => void;
  setTheme: (t: Theme) => void;
}

const initialPath =
  typeof window !== 'undefined' ? window.location.pathname : '/';

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'night';
  const v = window.localStorage.getItem('ev-theme');
  return v === 'dawn' || v === 'day' || v === 'night' ? v : 'night';
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    scrollProgress: 0,
    pinnedPanelId: null,
    activeRoute: initialPath,
    theme: readStoredTheme(),
    setScrollProgress: (n) => set({ scrollProgress: n }),
    setPinnedPanel: (id) => set({ pinnedPanelId: id }),
    setActiveRoute: (r) => set({ activeRoute: r }),
    setTheme: (t) => {
      if (typeof window !== 'undefined') window.localStorage.setItem('ev-theme', t);
      set({ theme: t });
    },
  }))
);
