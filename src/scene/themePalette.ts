import type { Theme } from '../store/appStore';

export interface ThemePalette {
  /** Canvas clear color + matched fog color (so horizon is seamless). */
  sky: string;
  /** Fog tint. Distinct from sky for warm-haze themes. */
  fog: string;
  /** Ground plane base color. */
  ground: string;
  /** Ambient light intensity. */
  ambient: number;
  /** Sky-fill light intensity (a soft directional/hemi top-light). */
  fill: number;
  /** Show drei <Stars />. */
  stars: boolean;
  /** Show the Moon. */
  moon: boolean;
  /** Bloom base intensity for this theme. */
  bloomBase: number;
}

// Fog color matches sky in every theme so the distant ground fades into the
// sky for a seamless horizon. The ground itself stays the dark navy from
// night mode in all themes — the flower garden, foliage, and biolume read
// only against a dark soil, and the fog reveal still hides the far edge.
const GROUND_DARK = '#0c1b2c';

export const PALETTES: Record<Theme, ThemePalette> = {
  night: {
    sky: '#0a1530',
    fog: '#0a1530',
    ground: GROUND_DARK,
    ambient: 0.15,
    fill: 0.0,
    stars: true,
    moon: true,
    bloomBase: 0.40,
  },
  dawn: {
    sky: '#4a2230',
    fog: '#4a2230',
    // Ground stays the shared dark color across all themes so the forest
    // floor and river basin never re-tint with the mode. Fog (which
    // matches the sky) blends the far ground into the sunset sky.
    ground: GROUND_DARK,
    ambient: 0.32,
    fill: 0.25,
    stars: false,
    moon: false,
    bloomBase: 0.55,
  },
  day: {
    // Vibrant light sky-blue. Canvas clear color & fog both use this so
    // the ground plane fades seamlessly into the sky at distance.
    sky: '#7fc4ec',
    fog: '#7fc4ec',
    ground: GROUND_DARK,
    ambient: 0.85,
    fill: 0.55,
    stars: false,
    moon: false,
    bloomBase: 0.20,
  },
};

export function getPalette(t: Theme): ThemePalette {
  return PALETTES[t];
}
