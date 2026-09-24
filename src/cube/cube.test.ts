import { describe, expect, it } from 'vitest';
import { applyTurn, createSolvedCube, isSolved, rotateVec, type CubeState } from './model';
import {
  applyMove,
  applyMoves,
  formatMoves,
  invertMove,
  MOVE_FACES,
  parseMoves,
  simplifyMoves,
  type Move,
} from './moves';

/** Canonical comparison that ignores array order and object identity. */
function snapshot(state: CubeState): string {
  return JSON.stringify(
    [...state]
      .sort((a, b) => a.id - b.id)
      .map((c) => ({
        id: c.id,
        position: c.position,
        stickers: [...c.stickers].sort((a, b) => a.color.localeCompare(b.color)),
      })),
  );
}

function repeat(moves: Move[], times: number): Move[] {
  return Array.from({ length: times }, () => moves).flat();
}

const solved = createSolvedCube();

describe('createSolvedCube', () => {
  it('has 26 cubies with 54 stickers in total', () => {
    expect(solved).toHaveLength(26);
    expect(solved.reduce((n, c) => n + c.stickers.length, 0)).toBe(54);
  });

  it('starts solved', () => {
    expect(isSolved(solved)).toBe(true);
  });
});

describe('rotateVec', () => {
  it('follows the right-hand rule', () => {
    expect(rotateVec([0, 1, 0], 'x', 1)).toEqual([0, 0, 1]);
    expect(rotateVec([0, 0, 1], 'y', 1)).toEqual([1, 0, 0]);
    expect(rotateVec([1, 0, 0], 'z', 1)).toEqual([0, 1, 0]);
  });

  it('treats negative turns as inverse rotations', () => {
    expect(rotateVec(rotateVec([1, 1, 0], 'z', 1), 'z', -1)).toEqual([1, 1, 0]);
  });
});

describe('moves', () => {
  it.each(MOVE_FACES)('%s applied four times is the identity', (face) => {
    const result = applyMoves(solved, repeat([{ face, amount: 1 }], 4));
    expect(snapshot(result)).toBe(snapshot(solved));
  });

  it.each(MOVE_FACES)('%s followed by its inverse is the identity', (face) => {
    const move: Move = { face, amount: 1 };
    const result = applyMove(applyMove(solved, move), invertMove(move));
    expect(snapshot(result)).toBe(snapshot(solved));
  });

  it.each(MOVE_FACES)('%s2 equals %s applied twice', (face) => {
    const twice = applyMoves(solved, repeat([{ face, amount: 1 }], 2));
    const half = applyMove(solved, { face, amount: 2 });
    expect(snapshot(half)).toBe(snapshot(twice));
  });

  it('any single quarter move unsolves the cube', () => {
    for (const face of MOVE_FACES) {
      expect(isSolved(applyMove(solved, { face, amount: 1 }))).toBe(false);
    }
  });

  it("R U R' U' repeated six times returns to solved", () => {
    const sexy = parseMoves("R U R' U'");
    const result = applyMoves(solved, repeat(sexy, 6));
    expect(snapshot(result)).toBe(snapshot(solved));
  });

  it('the checkerboard pattern M2 E2 S2 is its own inverse', () => {
    const checker = parseMoves('M2 E2 S2');
    const once = applyMoves(solved, checker);
    expect(isSolved(once)).toBe(false);
    expect(snapshot(applyMoves(once, checker))).toBe(snapshot(solved));
  });

  it('a scramble undone in reverse returns to solved', () => {
    const scramble = parseMoves("R U2 F' L D B2 R' U F2 D' L2 B M E' S2");
    const undo = [...scramble].reverse().map(invertMove);
    const result = applyMoves(applyMoves(solved, scramble), undo);
    expect(snapshot(result)).toBe(snapshot(solved));
  });

  it('R moves the front-right column onto the top face (clockwise from the right)', () => {
    const afterR = applyMove(solved, { face: 'R', amount: 1 });
    const topRight = afterR.find((c) => c.position.join() === '1,1,0')!;
    const topSticker = topRight.stickers.find((s) => s.normal.join() === '0,1,0')!;
    expect(topSticker.color).toBe('green');
  });

  it('U moves the front row to the left face (clockwise from the top)', () => {
    const afterU = applyMove(solved, { face: 'U', amount: 1 });
    const upLeft = afterU.find((c) => c.position.join() === '-1,1,0')!;
    const leftSticker = upLeft.stickers.find((s) => s.normal.join() === '-1,0,0')!;
    expect(leftSticker.color).toBe('green');
  });

  it('keeps positions on the integer grid and unique', () => {
    const scrambled = applyMoves(solved, parseMoves("R U F' L2 D B' M S' E2"));
    const keys = new Set(scrambled.map((c) => c.position.join()));
    expect(keys.size).toBe(26);
    for (const c of scrambled) {
      expect(c.position.every((n) => Number.isInteger(n) && Math.abs(n) <= 1)).toBe(true);
    }
  });

  it('does not mutate the input state', () => {
    const before = snapshot(solved);
    applyTurn(solved, { axis: 'x', layer: 1, quarterTurns: 1 });
    expect(snapshot(solved)).toBe(before);
  });
});

describe('notation', () => {
  it('round-trips through parse and format', () => {
    const text = "R U' F2 M E' S2";
    expect(formatMoves(parseMoves(text))).toBe(text);
  });

  it('rejects unknown tokens', () => {
    expect(() => parseMoves('R Q')).toThrow('Unknown move: "Q"');
  });
});

describe('simplifyMoves', () => {
  it.each([
    ['R R', 'R2'],
    ["R R'", ''],
    ['R2 R2', ''],
    ['R R R', "R'"],
    ["R2 R'", 'R'],
    ["R U U' R'", ''],
    ['R U R', 'R U R'],
  ])('%s simplifies to "%s"', (input, expected) => {
    expect(formatMoves(simplifyMoves(parseMoves(input)))).toBe(expected);
  });

  it('produces the same cube state as the original sequence', () => {
    const moves = parseMoves("R R U' U' U' F2 F L L' D M M E2 S S S B");
    expect(snapshot(applyMoves(solved, simplifyMoves(moves)))).toBe(
      snapshot(applyMoves(solved, moves)),
    );
  });
});
