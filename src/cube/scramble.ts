import type { Axis } from './model';
import type { Move, MoveAmount, MoveFace } from './moves';

const SCRAMBLE_FACES = ['U', 'D', 'L', 'R', 'F', 'B'] as const satisfies readonly MoveFace[];
const AMOUNTS: readonly MoveAmount[] = [1, -1, 2];

const AXIS_OF: Record<(typeof SCRAMBLE_FACES)[number], Axis> = {
  U: 'y',
  D: 'y',
  L: 'x',
  R: 'x',
  F: 'z',
  B: 'z',
};

export const SCRAMBLE_LENGTH = 25;

/**
 * Random-move scramble in the style of WCA 3x3 scrambles: face turns only, never the same
 * face twice in a row, and never three turns on one axis in a row (R L R is just R2 L).
 */
export function generateScramble(length = SCRAMBLE_LENGTH, random: () => number = Math.random): Move[] {
  const moves: { face: (typeof SCRAMBLE_FACES)[number]; amount: MoveAmount }[] = [];
  while (moves.length < length) {
    const face = SCRAMBLE_FACES[Math.floor(random() * SCRAMBLE_FACES.length)];
    const prev = moves[moves.length - 1];
    const prev2 = moves[moves.length - 2];

    if (prev?.face === face) continue;
    const axis = AXIS_OF[face];
    if (prev && prev2 && AXIS_OF[prev.face] === axis && AXIS_OF[prev2.face] === axis) continue;

    moves.push({ face, amount: AMOUNTS[Math.floor(random() * AMOUNTS.length)] });
  }
  return moves;
}
