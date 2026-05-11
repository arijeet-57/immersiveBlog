import { useLocation } from 'react-router-dom';
import { getRouteWaypoint, type RouteWaypoint } from '../routes/waypoints';

export function useRouteCamera(): RouteWaypoint | null {
  const { pathname } = useLocation();
  return getRouteWaypoint(pathname);
}
