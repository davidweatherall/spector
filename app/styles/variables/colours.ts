/**
 * Colour palette for the Spector esports/gaming theme
 * Professional gamer aesthetic with dark backgrounds and vibrant accents
 */

export const colours = {
  // Background colours
  bg: {
    primary: '#0a0a0f',      // Deep dark background
    secondary: '#12121a',    // Slightly lighter dark
    tertiary: '#1a1a25',     // Card backgrounds
    elevated: '#22222f',     // Elevated surfaces
    overlay: 'rgba(0, 0, 0, 0.8)', // Modal overlays
  },

  // Text colours
  text: {
    primary: '#ffffff',      // Primary text
    secondary: '#a0a0b0',    // Secondary/muted text
    tertiary: '#6b6b7a',     // Disabled/hint text
    inverse: '#0a0a0f',      // Text on light backgrounds
  },

  // Accent colours
  accent: {
    primary: '#00d4ff',      // Neon cyan - primary accent
    secondary: '#7b2fff',    // Electric purple
    tertiary: '#ff2d6a',     // Hot pink/magenta
    lol: '#c89b3c',          // League of Legends gold
    lolSecondary: '#785a28', // LoL bronze accent
    valorant: '#ff4655',     // Valorant red
    valorantSecondary: '#bd3944', // Valorant dark red
  },

  // Border colours
  border: {
    primary: '#2a2a3a',      // Default border
    secondary: '#3a3a4a',    // Hover border
    accent: '#00d4ff',       // Accent border
  },

  // Status colours
  status: {
    success: '#00ff88',      // Success green
    error: '#ff4455',        // Error red
    warning: '#ffaa00',      // Warning amber
    info: '#00d4ff',         // Info cyan
  },

  // Gradient definitions
  gradient: {
    primary: 'linear-gradient(135deg, #00d4ff 0%, #7b2fff 100%)',
    lol: 'linear-gradient(135deg, #c89b3c 0%, #785a28 100%)',
    valorant: 'linear-gradient(135deg, #ff4655 0%, #bd3944 100%)',
    dark: 'linear-gradient(180deg, #0a0a0f 0%, #12121a 100%)',
    glow: 'radial-gradient(ellipse at center, rgba(0, 212, 255, 0.15) 0%, transparent 70%)',
  },
} as const;

export type Colours = typeof colours;
