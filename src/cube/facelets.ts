import { AXIS_INDEX, rotateVec, type Color, type CubeState, type Turn, type Vec3 } from './model';

/** A face, and also the colour letter of a sticker: the face whose solved colour it has. */
export type FaceletColor = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

/**
 * 54 stickers in Kociemba order: U0–U8, R0–R8, F0–F8, D0–D8, L0–L8, B0–B8. Each face is read
 * row by row as seen from outside, with U on top for the four side faces, B on top for U,
 * and F on top for D. (Named so it doesn't clash with the per-cubie `CubeState`.)
 */
export type FaceletState = FaceletColor[];

export const FACE_ORDER: readonly FaceletColor[] = ['U', 'R', 'F', 'D', 'L', 'B'];

/** Index ranges per face, as in the manual's CUBE_INDEX_MAP. */
export const CUBE_INDEX_MAP = Object.fromEntries(
  FACE_ORDER.map((face, f) => [face, Array.from({ length: 9 }, (_, i) => f * 9 + i)]),
) as Record<FaceletColor, number[]>;

interface FaceFrame {
  normal: Vec3;
  /** 3D direction of increasing column (left to right) when viewing the face. */
  right: Vec3;
  /** 3D direction of increasing row (top to bottom) when viewing the face. */
  down: Vec3;
}

export const FACE_FRAMES: Record<FaceletColor, FaceFrame> = {
  U: { normal: [0, 1, 0], right: [1, 0, 0], down: [0, 0, 1] },
  R: { normal: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0] },
  F: { normal: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] },
  D: { normal: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1] },
  L: { normal: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0] },
  B: { normal: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0] },
};

/** Solved colour scheme: white top, green front. */
const FACE_OF_COLOR: Record<Color, FaceletColor> = {
  white: 'U',
  red: 'R',
  green: 'F',
  yellow: 'D',
  orange: 'L',
  blue: 'B',
};

export const COLOR_OF_FACE = Object.fromEntries(
  Object.entries(FACE_OF_COLOR).map(([color, face]) => [face, color]),
) as Record<FaceletColor, Color>;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const same = (a: Vec3, b: Vec3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

export function faceOfNormal(normal: Vec3): FaceletColor {
  return FACE_ORDER.find((face) => same(FACE_FRAMES[face].normal, normal))!;
}

/** Index (0–53) of the sticker on `face` belonging to the cubie at `position`. */
export function faceletIndex(face: FaceletColor, position: Vec3): number {
  const { right, down } = FACE_FRAMES[face];
  const col = dot(position, right) + 1;
  const row = dot(position, down) + 1;
  return FACE_ORDER.indexOf(face) * 9 + row * 3 + col;
}

export function toFacelets(cubies: CubeState): FaceletState {
  const facelets = new Array<FaceletColor>(54);
  for (const { position, stickers } of cubies) {
    for (const { normal, color } of stickers) {
      facelets[faceletIndex(faceOfNormal(normal), position)] = FACE_OF_COLOR[color];
    }
  }
  return facelets;
}

export interface FaceGridSticker {
  index: number;
  /** Column and row offsets from the face centre, each in {-1, 0, 1}. */
  col: number;
  row: number;
}

/** The face's own 9 stickers in index order. */
export function faceGrid(face: FaceletColor): FaceGridSticker[] {
  return Array.from({ length: 9 }, (_, i) => ({
    index: FACE_ORDER.indexOf(face) * 9 + i,
    col: (i % 3) - 1,
    row: Math.floor(i / 3) - 1,
  }));
}

export interface StickerPlace {
  face: FaceletColor;
  /** Grid position of the cubie the sticker is on. */
  position: Vec3;
  /** Direction the sticker faces (the face's normal). */
  normal: Vec3;
}

/** Where sticker `index` (0–53) sits on the cube. */
export function stickerAt(index: number): StickerPlace {
  const face = FACE_ORDER[Math.floor(index / 9)];
  const { normal, right, down } = FACE_FRAMES[face];
  const { col, row } = faceGrid(face)[index % 9];
  const position = [0, 1, 2].map(
    (i) => normal[i] + right[i] * col + down[i] * row,
  ) as unknown as Vec3;
  return { face, position, normal };
}

/**
 * Where each sticker ends up after a layer turn: `perm[i]` is the new index of the sticker
 * that was at index `i`. Stickers outside the layer map to themselves.
 */
export function turnPermutation(turn: Turn): number[] {
  const axisIndex = AXIS_INDEX[turn.axis];
  return Array.from({ length: 54 }, (_, i) => {
    const { position, normal } = stickerAt(i);
    if (position[axisIndex] !== turn.layer) return i;
    const moved = rotateVec(position, turn.axis, turn.quarterTurns);
    return faceletIndex(faceOfNormal(rotateVec(normal, turn.axis, turn.quarterTurns)), moved);
  });
}
