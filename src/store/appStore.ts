import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface AppState {
  scrollProgress: number;
  pinnedPanelId: string | null;
  activeRoute: string;
  setScrollProgress: (n: number) => void;
  setPinnedPanel: (id: string | null) => void;
  setActiveRoute: (r: string) => void;
}

const initialPath =
  typeof window !== 'undefined' ? window.location.pathname : '/';

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    scrollProgress: 0,
    pinnedPanelId: null,
    activeRoute: initialPath,
    setScrollProgress: (n) => set({ scrollProgress: n }),
    setPinnedPanel: (id) => set({ pinnedPanelId: id }),
    setActiveRoute: (r) => set({ activeRoute: r }),
  }))
);
