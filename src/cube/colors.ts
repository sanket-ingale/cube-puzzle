import type { Color } from './model';

/** The usual cube colours, shared by the 3D materials and the 2D view's fills. */
export const STANDARD_PALETTE: Record<Color, string> = {
  white: '#f4f4f4',
  yellow: '#ffd500',
  green: '#009e60',
  blue: '#0051ba',
  red: '#c41e3a',
  orange: '#ff5800',
};

/**
 * For colour-blind players: the pairs that are hardest to tell apart (red/orange, green/blue,
 * and red/green for the most common colour blindness) differ strongly in brightness as well.
 */
export const HIGH_CONTRAST_PALETTE: Record<Color, string> = {
  white: '#ffffff',
  yellow: '#ffe14d',
  green: '#35d46a',
  blue: '#1c3fd1',
  red: '#a3001b',
  orange: '#ffa53d',
};

/** Kept for code that only needs the standard colours. */
export const COLOR_HEX = STANDARD_PALETTE;

/** Initials shown on stickers when letters are switched on. */
export const COLOR_LETTER: Record<Color, string> = {
  white: 'W',
  yellow: 'Y',
  green: 'G',
  blue: 'B',
  red: 'R',
  orange: 'O',
};

export const paletteFor = (highContrast: boolean) =>
  highContrast ? HIGH_CONTRAST_PALETTE : STANDARD_PALETTE;
