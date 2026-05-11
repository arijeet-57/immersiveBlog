import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { isModalRoute } from './waypoints';

export default function RouteSync() {
  const { pathname } = useLocation();
  const setActiveRoute = useAppStore((s) => s.setActiveRoute);
  const setLocked = useAppStore((s) => s.setLocked);

  useEffect(() => {
    setActiveRoute(pathname);
    setLocked(isModalRoute(pathname));
  }, [pathname, setActiveRoute, setLocked]);

  return null;
}
