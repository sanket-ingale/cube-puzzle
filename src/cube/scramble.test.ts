import { describe, expect, it } from 'vitest';
import { createSolvedCube, isSolved } from './model';
import { applyMoves } from './moves';
import { generateScramble, SCRAMBLE_LENGTH } from './scramble';

/** Small seeded PRNG so failures are reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const axisOf = (face: string) => ({ U: 'y', D: 'y', L: 'x', R: 'x', F: 'z', B: 'z' })[face];

describe('generateScramble', () => {
  const scrambles = Array.from({ length: 200 }, (_, i) => generateScramble(SCRAMBLE_LENGTH, mulberry32(i)));

  it('has the requested length and only uses face turns', () => {
    for (const s of scrambles) {
      expect(s).toHaveLength(SCRAMBLE_LENGTH);
      expect(s.every((m) => 'UDLRFB'.includes(m.face))).toBe(true);
    }
    expect(generateScramble(10, mulberry32(1))).toHaveLength(10);
  });

  it('never turns the same face twice in a row', () => {
    for (const s of scrambles) {
      for (let i = 1; i < s.length; i++) expect(s[i].face).not.toBe(s[i - 1].face);
    }
  });

  it('never turns the same axis three times in a row', () => {
    for (const s of scrambles) {
      for (let i = 2; i < s.length; i++) {
        const axes = new Set([s[i - 2], s[i - 1], s[i]].map((m) => axisOf(m.face)));
        expect(axes.size).toBeGreaterThan(1);
      }
    }
  });

  it('is deterministic for a given random source', () => {
    expect(generateScramble(25, mulberry32(42))).toEqual(generateScramble(25, mulberry32(42)));
  });

  it('leaves the cube unsolved', () => {
    for (const s of scrambles) expect(isSolved(applyMoves(createSolvedCube(), s))).toBe(false);
  });
});
