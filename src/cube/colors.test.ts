import { describe, expect, it } from 'vitest';
import { HIGH_CONTRAST_PALETTE, STANDARD_PALETTE } from './colors';

/** Relative luminance (WCAG) of a #rrggbb colour. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('high-contrast palette', () => {
  it.each([
    ['red', 'orange'],
    ['green', 'blue'],
    ['red', 'green'],
  ] as const)('separates %s and %s by brightness more than the standard colours do', (a, b) => {
    const standard = contrast(STANDARD_PALETTE[a], STANDARD_PALETTE[b]);
    const high = contrast(HIGH_CONTRAST_PALETTE[a], HIGH_CONTRAST_PALETTE[b]);
    expect(high).toBeGreaterThan(standard);
    expect(high).toBeGreaterThan(2.5);
  });
});
