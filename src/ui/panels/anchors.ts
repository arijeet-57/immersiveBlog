import type { CSSProperties } from 'react';
import type { PanelAnchor } from './registry';

/**
 * Returns the outer wrapper position styles for a given anchor.
 * The inner .panel-content div is what GSAP animates (opacity + translate),
 * so the wrapper does the static positioning only.
 */
export function anchorStyle(anchor: PanelAnchor): CSSProperties {
  switch (anchor) {
    case 'center':
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    case 'center-low':
      return { bottom: '18vh', left: '50%', transform: 'translateX(-50%)' };
    case 'bottom-left':
      return { bottom: '8vh', left: '4vw' };
    case 'bottom-right':
      return { bottom: '8vh', right: '4vw' };
    case 'bottom-center':
      return { bottom: '8vh', left: '50%', transform: 'translateX(-50%)' };
    case 'left':
      return { top: '50%', left: '4vw', transform: 'translateY(-50%)' };
    case 'right':
      return { top: '50%', right: '4vw', transform: 'translateY(-50%)' };
  }
}

/** Entry/exit delta in px applied to the .panel-content as it fades. */
export function entryOffset(anchor: PanelAnchor): { x: number; y: number } {
  switch (anchor) {
    case 'center':
    case 'center-low':
      return { x: 0, y: 24 };
    case 'bottom-left':
      return { x: -28, y: 0 };
    case 'bottom-right':
      return { x: 28, y: 0 };
    case 'bottom-center':
      return { x: 0, y: 28 };
    case 'left':
      return { x: -32, y: 0 };
    case 'right':
      return { x: 32, y: 0 };
  }
}
