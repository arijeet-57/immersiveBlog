import { useAppStore } from '../store/appStore';

export function useScrollProgress() {
  return useAppStore((s) => s.scrollProgress);
}

export function getScrollProgress() {
  return useAppStore.getState().scrollProgress;
}
