import type { Vec3 } from '../cube/model';
import {
  faceletIndex,
  faceOfNormal,
  stickerAt,
  turnPermutation,
  type FaceletColor,
  type FaceletState,
} from '../cube/facelets';
import { moveToTurn, turnToMove, type Move } from '../cube/moves';
import { ALL_FRAMES, toVector, type FrameSlot, type ViewFrame } from '../keys/frame';

/**
 * The beginner's method is taught holding the cube a certain way: U is the top face, F the
 * face on the left of the corner view and R the face on the right. These helpers look at the
 * cube "as held" in a view frame, and turn moves made in that holding back into real moves.
 */

const SLOT_OF_AXIS: Record<'x' | 'y' | 'z', FrameSlot> = { x: 'right', y: 'top', z: 'left' };

const frameKey = (f: ViewFrame) => `${f.right.axis}${f.right.sign}${f.top.axis}${f.top.sign}`;

/** For each held sticker index, the real sticker index it is. */
const INDEX_MAPS = new Map<string, number[]>();

function indexMap(frame: ViewFrame): number[] {
  const key = frameKey(frame);
  let map = INDEX_MAPS.get(key);
  if (map) return map;
  const r = toVector(frame.right);
  const t = toVector(frame.top);
  const l = toVector(frame.left);
  const rotate = (v: Vec3): Vec3 => [0, 1, 2].map((i) => v[0] * r[i] + v[1] * t[i] + v[2] * l[i]) as unknown as Vec3;
  map = Array.from({ length: 54 }, (_, i) => {
    const { position, normal } = stickerAt(i);
    return faceletIndex(faceOfNormal(rotate(normal)), rotate(position));
  });
  INDEX_MAPS.set(key, map);
  return map;
}

/** The cube as seen held in a frame: sticker i of the result is the held U/R/F/D/L/B sticker i. */
export function heldState(state: FaceletState, frame: ViewFrame): FaceletState {
  const map = indexMap(frame);
  return map.map((real) => state[real]);
}

/** Real sticker indices for held ones, e.g. to light up a piece on the real cube. */
export function realIndices(indices: number[], frame: ViewFrame): number[] {
  const map = indexMap(frame);
  return indices.map((i) => map[i]);
}

/** A move made while holding the cube in a frame, as a real move. */
export function heldMoveToReal(move: Move, frame: ViewFrame): Move {
  const turn = moveToTurn(move);
  const { axis, sign } = frame[SLOT_OF_AXIS[turn.axis]];
  return turnToMove({ axis, layer: (turn.layer * sign) as -1 | 0 | 1, quarterTurns: turn.quarterTurns * sign });
}

const PERMS = new Map<string, number[]>();
const permFor = (move: Move) => {
  const key = `${move.face}${move.amount}`;
  let perm = PERMS.get(key);
  if (!perm) {
    perm = turnPermutation(moveToTurn(move));
    PERMS.set(key, perm);
  }
  return perm;
};

/** Applies a move to a sticker state (real or held; moves are in the same terms as the state). */
export function applyToFacelets(state: FaceletState, move: Move): FaceletState {
  const perm = permFor(move);
  const out = new Array<FaceletColor>(54);
  for (let i = 0; i < 54; i++) out[perm[i]] = state[i];
  return out;
}

export const applyAllToFacelets = (state: FaceletState, moves: readonly Move[]) => moves.reduce(applyToFacelets, state);

/** The four ways to hold the cube with a given centre colour on top. */
export function framesWithTop(state: FaceletState, colour: FaceletColor): ViewFrame[] {
  return ALL_FRAMES.filter((f) => heldState(state, f)[4] === colour);
}
