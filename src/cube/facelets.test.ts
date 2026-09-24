import { describe, expect, it } from 'vitest';
import { createSolvedCube } from './model';
import { applyMove, applyMoves, moveToTurn, parseMoves } from './moves';
import {
  CUBE_INDEX_MAP,
  FACE_ORDER,
  faceletIndex,
  stickerAt,
  toFacelets,
  turnPermutation,
} from './facelets';

const solved = createSolvedCube();
const str = (moves: string) =>
  toFacelets(moves ? applyMoves(solved, parseMoves(moves)) : solved).join('');

describe('toFacelets', () => {
  it('matches the Kociemba string for a solved cube', () => {
    expect(str('')).toBe('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
  });

  it('matches the known string after R', () => {
    expect(str('R')).toBe('UUFUUFUUFRRRRRRRRRFFDFFDFFDDDBDDBDDBLLLLLLLLLUBBUBBUBB');
  });

  it('matches the known string after U', () => {
    expect(str('U')).toBe('UUUUUUUUUBBBRRRRRRRRRFFFFFFDDDDDDDDDFFFLLLLLLLLLBBBBBB');
  });

  it('matches the known string after F', () => {
    expect(str('F')).toBe('UUUUUULLLURRURRURRFFFFFFFFFRRRDDDDDDLLDLLDLLDBBBBBBBBB');
  });

  it('fills every index exactly once, with 9 of each colour', () => {
    const facelets = toFacelets(applyMoves(solved, parseMoves("R U2 F' L D B2 M E' S")));
    expect(facelets).toHaveLength(54);
    expect(facelets.every(Boolean)).toBe(true);
    for (const face of FACE_ORDER) expect(facelets.filter((f) => f === face)).toHaveLength(9);
  });
});

describe('faceletIndex', () => {
  it('reads faces in Kociemba orientation', () => {
    expect(faceletIndex('U', [-1, 1, -1])).toBe(0); // U: back-left corner first
    expect(faceletIndex('U', [0, 1, 1])).toBe(7); // U7 borders F
    expect(faceletIndex('F', [0, 1, 1])).toBe(19); // ...and is the same edge piece as F1
    expect(faceletIndex('D', [-1, -1, 1])).toBe(27); // D: front-left corner first
    expect(faceletIndex('B', [1, 1, -1])).toBe(45); // B: seen from behind, right side first
  });

  it('matches the index map ranges', () => {
    expect(CUBE_INDEX_MAP.U).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(CUBE_INDEX_MAP.B).toEqual([45, 46, 47, 48, 49, 50, 51, 52, 53]);
  });
});

describe('turnPermutation', () => {
  it('agrees with the cube model for every layer turn', () => {
    const start = applyMoves(solved, parseMoves("R U F' L2 D B' M S"));
    const before = toFacelets(start);
    for (const face of ['U', 'D', 'L', 'R', 'F', 'B', 'M', 'E', 'S'] as const) {
      const move = { face, amount: 1 as const };
      const after = toFacelets(applyMove(start, move));
      const perm = turnPermutation(moveToTurn(move));
      perm.forEach((to, from) => expect(after[to]).toBe(before[from]));
    }
  });

  it('round-trips stickerAt through faceletIndex', () => {
    for (let i = 0; i < 54; i++) {
      const { face, position } = stickerAt(i);
      expect(faceletIndex(face, position)).toBe(i);
    }
  });
});
