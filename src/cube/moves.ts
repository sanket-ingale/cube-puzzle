import { applyTurn, type CubeState, type Turn } from './model';

export type MoveFace = 'U' | 'D' | 'L' | 'R' | 'F' | 'B' | 'M' | 'E' | 'S';

/** 1 = clockwise, -1 = counter-clockwise (prime), 2 = half turn. */
export type MoveAmount = 1 | -1 | 2;

export interface Move {
  face: MoveFace;
  amount: MoveAmount;
}

/**
 * The geometric turn for one clockwise quarter of each face, as seen when looking
 * directly at that face. Clockwise from +axis is a negative right-hand rotation.
 * Slices follow their conventional reference face: M like L, E like D, S like F.
 */
const CLOCKWISE_TURNS: Record<MoveFace, Turn> = {
  R: { axis: 'x', layer: 1, quarterTurns: -1 },
  L: { axis: 'x', layer: -1, quarterTurns: 1 },
  M: { axis: 'x', layer: 0, quarterTurns: 1 },
  U: { axis: 'y', layer: 1, quarterTurns: -1 },
  D: { axis: 'y', layer: -1, quarterTurns: 1 },
  E: { axis: 'y', layer: 0, quarterTurns: 1 },
  F: { axis: 'z', layer: 1, quarterTurns: -1 },
  B: { axis: 'z', layer: -1, quarterTurns: 1 },
  S: { axis: 'z', layer: 0, quarterTurns: -1 },
};

export const MOVE_FACES = Object.keys(CLOCKWISE_TURNS) as MoveFace[];

export function moveToTurn({ face, amount }: Move): Turn {
  const base = CLOCKWISE_TURNS[face];
  return { ...base, quarterTurns: base.quarterTurns * amount };
}

/**
 * The notation move for a layer turn, e.g. x layer 1 at -90° is R. Any multiple of a quarter
 * is reduced to the equivalent single move: three quarters one way is one quarter the other.
 */
export function turnToMove(turn: Turn): Move {
  const face = MOVE_FACES.find(
    (f) => CLOCKWISE_TURNS[f].axis === turn.axis && CLOCKWISE_TURNS[f].layer === turn.layer,
  )!;
  const quarters = (((turn.quarterTurns % 4) + 4) % 4) as 0 | 1 | 2 | 3;
  if (quarters === 2) return { face, amount: 2 };
  const signed = quarters === 1 ? 1 : -1;
  return { face, amount: (signed * CLOCKWISE_TURNS[face].quarterTurns) as MoveAmount };
}

export function invertMove(move: Move): Move {
  return { face: move.face, amount: move.amount === 2 ? 2 : (-move.amount as MoveAmount) };
}

export function applyMove(state: CubeState, move: Move): CubeState {
  return applyTurn(state, moveToTurn(move));
}

export function applyMoves(state: CubeState, moves: readonly Move[]): CubeState {
  return moves.reduce(applyMove, state);
}

const AMOUNT_BY_QUARTERS: Record<number, MoveAmount> = { 1: 1, 2: 2, 3: -1 };

/**
 * Merge consecutive turns of the same face: R R becomes R2, and R R' or R2 R2 cancel out.
 * Merging cascades, so R U U' R' collapses to nothing.
 */
export function simplifyMoves(moves: readonly Move[]): Move[] {
  const result: Move[] = [];
  for (const move of moves) {
    const last = result[result.length - 1];
    if (last?.face !== move.face) {
      result.push(move);
      continue;
    }
    const quarters = (((last.amount + move.amount) % 4) + 4) % 4;
    result.pop();
    if (quarters !== 0) result.push({ face: move.face, amount: AMOUNT_BY_QUARTERS[quarters] });
  }
  return result;
}

const MOVE_PATTERN = /^([UDLRFBMES])(2|')?$/;

/** Parse standard notation such as "R U R' U2". Throws on unknown tokens. */
export function parseMoves(notation: string): Move[] {
  return notation
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const match = MOVE_PATTERN.exec(token);
      if (!match) throw new Error(`Unknown move: "${token}"`);
      const amount: MoveAmount = match[2] === '2' ? 2 : match[2] === "'" ? -1 : 1;
      return { face: match[1] as MoveFace, amount };
    });
}

export function formatMove({ face, amount }: Move): string {
  return face + (amount === 2 ? '2' : amount === -1 ? "'" : '');
}

export function formatMoves(moves: readonly Move[]): string {
  return moves.map(formatMove).join(' ');
}
