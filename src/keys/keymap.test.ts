import { describe, expect, it } from 'vitest';
import { applyMove, applyMoves, parseMoves } from '../cube/moves';
import { createSolvedCube } from '../cube/model';
import { CUBE_INDEX_MAP, toFacelets } from '../cube/facelets';
import { describeKeyPress, keyForMove, TURN_KEYS, turnKeyMove } from './keymap';

/**
 * Stickers are tracked by index: in the default view the left face is F (read with U on top,
 * left to right) and the right face is R (its column 0 is the one touching F).
 */
const F = CUBE_INDEX_MAP.F;
const R = CUBE_INDEX_MAP.R;
const U = CUBE_INDEX_MAP.U;
const start = applyMoves(createSolvedCube(), parseMoves("R U F' L2 D B' M S E2"));
const before = toFacelets(start);
const after = (code: string, reversed = false) => toFacelets(applyMove(start, turnKeyMove(code, reversed)!));

describe('turn keys', () => {
  // A quarter turn moves a column a whole face along: "down" brings the top face's matching
  // stickers over the top edge onto the side face, and Space sends the side face's up there.
  it.each([
    ['KeyQ', 0],
    ['KeyW', 1],
    ['KeyE', 2],
  ])('%s turns column %i of the left face down, and up with Space', (code, col) => {
    const down = after(code);
    const up = after(code, true);
    for (const row of [0, 1, 2]) {
      // U is read with the back at the top, so its row r lines up with F's row r.
      expect(down[F[row * 3 + col]]).toBe(before[U[row * 3 + col]]);
      expect(up[U[row * 3 + col]]).toBe(before[F[row * 3 + col]]);
    }
  });

  it.each([
    ['KeyI', 0],
    ['KeyO', 1],
    ['KeyP', 2],
  ])('%s turns column %i of the right face down, and up with Space', (code, col) => {
    const down = after(code);
    const up = after(code, true);
    for (const k of [0, 1, 2]) {
      // R's column c runs under the top face's row 2 - c (front row for the column by F),
      // with the top face's left end arriving at the top of the column.
      expect(down[R[k * 3 + col]]).toBe(before[U[(2 - col) * 3 + k]]);
      expect(up[U[(2 - col) * 3 + k]]).toBe(before[R[k * 3 + col]]);
    }
  });

  it.each([
    ['KeyF', 0],
    ['KeyG', 1],
    ['KeyH', 2],
  ])('%s moves row %i from the left face onto the right face, and back with Space', (code, row) => {
    const right = after(code);
    const left = after(code, true);
    for (const col of [0, 1, 2]) {
      expect(right[R[row * 3 + col]]).toBe(before[F[row * 3 + col]]);
      expect(left[F[row * 3 + col]]).toBe(before[R[row * 3 + col]]);
    }
  });

  it('covers all nine layers, once each', () => {
    expect(new Set(TURN_KEYS.map((k) => k.move.face))).toEqual(new Set(['L', 'M', 'R', 'F', 'S', 'B', 'U', 'E', 'D']));
  });

  it('ignores other keys', () => {
    expect(turnKeyMove('KeyU', false)).toBeNull();
    expect(turnKeyMove('Space', false)).toBeNull();
  });
});

describe('keyForMove', () => {
  it('finds a key for every quarter and half turn, and the key makes that move', () => {
    for (const face of ['U', 'D', 'L', 'R', 'F', 'B', 'M', 'E', 'S'] as const) {
      for (const amount of [1, -1, 2] as const) {
        const press = keyForMove({ face, amount })!;
        expect(press).not.toBeNull();
        const once = turnKeyMove(press.key.code, press.reversed)!;
        const expected = toFacelets(applyMove(start, { face, amount }));
        const made = press.times === 2 ? applyMove(applyMove(start, once), once) : applyMove(start, once);
        expect(toFacelets(made)).toEqual(expected);
      }
    }
  });

  it('describes the key to press', () => {
    expect(describeKeyPress(keyForMove({ face: 'L', amount: 1 })!)).toBe('Q');
    expect(describeKeyPress(keyForMove({ face: 'R', amount: 1 })!)).toBe('Space + E');
    expect(describeKeyPress(keyForMove({ face: 'U', amount: 2 })!)).toBe('F twice');
  });
});
