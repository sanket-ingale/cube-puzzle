import { invertMove, parseMoves, type Move } from '../cube/moves';

/**
 * Turn keys, read by physical key position (KeyboardEvent.code) so the layout is the
 * same on QWERTY, AZERTY and QWERTZ keyboards. Seen from the default corner view:
 *
 *   Q W E  turn the left face's left / middle / right column down
 *   I O P  turn the right face's left / middle / right column down
 *   F G H  turn the top / middle / bottom row to the right
 *
 * Holding Space turns them the other way. Keys follow positions, not colours: after a slice
 * turn moves the centres, Q still turns the left column of the left face.
 */
export interface TurnKey {
  code: string;
  /** The key's label on a US keyboard, for the on-screen guide. */
  label: string;
  move: Move;
  group: 'left' | 'right' | 'rows';
  /** Plain words for the guide, e.g. "left column". */
  part: string;
}

const key = (code: string, move: string, group: TurnKey['group'], part: string): TurnKey => ({
  code,
  label: code.replace('Key', ''),
  move: parseMoves(move)[0],
  group,
  part,
});

export const TURN_KEYS: TurnKey[] = [
  key('KeyQ', 'L', 'left', 'left column'),
  key('KeyW', 'M', 'left', 'middle column'),
  key('KeyE', "R'", 'left', 'right column'),
  key('KeyI', 'F', 'right', 'left column'),
  key('KeyO', 'S', 'right', 'middle column'),
  key('KeyP', "B'", 'right', 'right column'),
  key('KeyF', "U'", 'rows', 'top row'),
  key('KeyG', 'E', 'rows', 'middle row'),
  key('KeyH', 'D', 'rows', 'bottom row'),
];

const BY_CODE = new Map(TURN_KEYS.map((k) => [k.code, k]));

/** The move for a key press, or null if the key isn't a turn key. */
export function turnKeyMove(code: string, reversed: boolean): Move | null {
  const found = BY_CODE.get(code);
  if (!found) return null;
  return reversed ? invertMove(found.move) : found.move;
}

export interface KeyPress {
  key: TurnKey;
  /** Whether Space has to be held (or the reverse key on). */
  reversed: boolean;
  /** Half turns are the same key twice. */
  times: 1 | 2;
}

/** Which key makes a move. Every layer has a key, so every move has an answer. */
export function keyForMove(move: Move): KeyPress | null {
  const found = TURN_KEYS.find((k) => k.move.face === move.face);
  if (!found) return null;
  if (move.amount === 2) return { key: found, reversed: false, times: 2 };
  return { key: found, reversed: move.amount !== found.move.amount, times: 1 };
}

/** "E", "Space + E" or "E twice", for hints. */
export function describeKeyPress({ key, reversed, times }: KeyPress): string {
  return `${reversed ? 'Space + ' : ''}${key.label}${times === 2 ? ' twice' : ''}`;
}
