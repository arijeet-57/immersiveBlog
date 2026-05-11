import { create } from 'zustand';
import { isModalRoute } from '../routes/waypoints';

interface AppState {
  scrollProgress: number;
  isLocked: boolean;
  activeRoute: string;
  setScrollProgress: (n: number) => void;
  setLocked: (v: boolean) => void;
  setActiveRoute: (r: string) => void;
}

const initialPath =
  typeof window !== 'undefined' ? window.location.pathname : '/';

export const useAppStore = create<AppState>((set) => ({
  scrollProgress: 0,
  isLocked: isModalRoute(initialPath),
  activeRoute: initialPath,
  setScrollProgress: (n) => set({ scrollProgress: n }),
  setLocked: (v) => set({ isLocked: v }),
  setActiveRoute: (r) => set({ activeRoute: r }),
}));
