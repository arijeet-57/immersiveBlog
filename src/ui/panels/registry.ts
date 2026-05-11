export type PanelAnchor =
  | 'center'
  | 'bottom-left'
  | 'right'
  | 'left'
  | 'bottom-right'
  | 'bottom-center'
  | 'center-low';

export interface PanelSpec {
  id: string;
  range: [number, number, number]; // [start, peak, end] in scroll-progress space
  anchor: PanelAnchor;
  title: string;
  route?: string; // named route that pins this panel
}

export const PANELS: PanelSpec[] = [
  { id: 'intro',      range: [0.00, 0.05, 0.15], anchor: 'center',         title: 'Ethereal Valley' },
  { id: 'about',      range: [0.12, 0.18, 0.28], anchor: 'bottom-left',    title: 'About' },
  { id: 'chronicles', range: [0.25, 0.32, 0.50], anchor: 'right',          title: 'Chronicles', route: '/chronicles' },
  { id: 'featured',   range: [0.42, 0.50, 0.62], anchor: 'left',           title: 'Featured' },
  { id: 'sanctuary',  range: [0.58, 0.65, 0.75], anchor: 'bottom-right',   title: 'Sanctuary',  route: '/sanctuary' },
  { id: 'whispers',   range: [0.72, 0.78, 0.88], anchor: 'bottom-center',  title: 'Whispers',   route: '/whispers' },
  { id: 'closing',    range: [0.88, 0.94, 1.00], anchor: 'center-low',     title: 'The Valley Remembers' },
];

export const PIN_UNPIN_TOLERANCE = 0.05;

export function routeToPanel(pathname: string): PanelSpec | undefined {
  if (pathname === '/') return undefined;
  if (pathname.startsWith('/chronicles/')) {
    return PANELS.find((p) => p.id === 'featured');
  }
  return PANELS.find((p) => p.route === pathname);
}

export function panelById(id: string): PanelSpec | undefined {
  return PANELS.find((p) => p.id === id);
}
