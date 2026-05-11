export interface RouteWaypoint {
  position: [number, number, number];
  lookAt: [number, number, number];
}

export const routeWaypoints: Record<string, RouteWaypoint> = {
  '/chronicles':       { position: [-3, 2, 5],    lookAt: [-3, 0.5, 0] },
  '/sanctuary':        { position: [0, 2, 5],     lookAt: [0, 0.5, 0] },
  '/whispers':         { position: [3, 2, 5],     lookAt: [3, 0.5, 0] },
  '/valley':           { position: [0, 30, -120], lookAt: [0, 5, -300] },
  '/chronicles/_post': { position: [0, 5, -50],   lookAt: [0, 1, -90] },
  '/notfound':         { position: [40, 50, 40],  lookAt: [0, 5, 0] },
};

export function getRouteWaypoint(pathname: string): RouteWaypoint | null {
  if (pathname === '/') return null;
  if (pathname.startsWith('/chronicles/')) return routeWaypoints['/chronicles/_post'];
  return routeWaypoints[pathname] ?? routeWaypoints['/notfound'];
}

export function isModalRoute(pathname: string): boolean {
  if (pathname === '/' || pathname === '/valley') return false;
  return true;
}
