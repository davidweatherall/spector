/**
 * Unified theme export for the Spector esports application
 * Combines colours and typography into a single theme object
 */

import { colours, type Colours } from './variables/colours';
import { typography, type Typography } from './variables/typography';

// Combined theme object
export const theme = {
  colours,
  typography,
} as const;

// Re-export individual modules for direct imports
export { colours, typography };
export type { Colours, Typography };

// Spacing scale (consistent with modern design systems)
export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  3.5: '0.875rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '1.75rem',
  8: '2rem',
  9: '2.25rem',
  10: '2.5rem',
  12: '3rem',
  14: '3.5rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  28: '7rem',
  32: '8rem',
} as const;

// Border radius
export const borderRadius = {
  none: '0',
  sm: '0.25rem',
  base: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  full: '9999px',
} as const;

// Transitions
export const transitions = {
  fast: '150ms ease',
  base: '200ms ease',
  slow: '300ms ease',
  slower: '500ms ease',
} as const;

// Box shadows
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.5), 0 1px 2px -1px rgba(0, 0, 0, 0.5)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.5)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
  glow: '0 0 20px rgba(0, 212, 255, 0.3)',
  glowLol: '0 0 20px rgba(200, 155, 60, 0.3)',
  glowValorant: '0 0 20px rgba(255, 70, 85, 0.3)',
} as const;

export type Theme = typeof theme;
