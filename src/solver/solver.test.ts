import { beforeAll, describe, expect, it } from 'vitest';
import Cube from 'cubejs';
import { createSolvedCube, isSolved } from '../cube/model';
import { applyMoves, formatMoves, parseMoves } from '../cube/moves';
import { generateScramble } from '../cube/scramble';
import { SOLVED_INPUT, solverInput } from './facelets';
import { findSolution } from './search';

beforeAll(() => {
  Cube.initSolver();
}, 30_000);

const solveCubies = (moves: string) => {
  const cubies = applyMoves(createSolvedCube(), parseMoves(moves));
  const solution = parseMoves(findSolution(Cube.fromString(solverInput(cubies))));
  return { solution, after: applyMoves(cubies, solution) };
};

describe('solver', () => {
  it('reads a solved cube as the solved string', () => {
    expect(solverInput(createSolvedCube())).toBe(SOLVED_INPUT);
  });

  it('solves random scrambles in at most 22 moves', () => {
    for (let i = 0; i < 10; i++) {
      const { solution, after } = solveCubies(formatMoves(generateScramble()));
      expect(isSolved(after)).toBe(true);
      expect(solution.length).toBeLessThanOrEqual(22);
    }
  });

  it('solves positions reached with slice moves, whose centres have moved', () => {
    for (const moves of ['M', "M E S", "R M' U E2 F S'", 'M2 E2 S2']) {
      expect(isSolved(solveCubies(moves).after)).toBe(true);
    }
  });

  it('finds the exact reverse when the cube is a few moves from solved', () => {
    expect(solveCubies('R').solution).toEqual(parseMoves("R'"));
    expect(solveCubies('R U').solution).toEqual(parseMoves("U' R'"));
    expect(solveCubies("R U R' U'").solution).toHaveLength(4);
  });
});
