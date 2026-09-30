import type { Turn } from '../cube/model';
import { moveToTurn, turnToMove, type Move } from '../cube/moves';
import { DEFAULT_FRAME, type FrameSlot, type ViewFrame } from './frame';

/**
 * Turn keys, read by physical key position (KeyboardEvent.code) so the layout is the same on
 * QWERTY, AZERTY and QWERTZ keyboards. In whichever corner view the camera is in:
 *
 *   Q W E  turn the left face's left / middle / right column down
 *   I O P  turn the right face's left / middle / right column down
 *   F G H  turn the top / middle / bottom row to the right
 *
 * Holding Space turns them the other way. Keys follow positions, never colours or a fixed
 * orientation: Q always turns the left column of whatever face is on the left right now.
 */
export interface TurnKey {
  code: string;
  /** The key's label on a US keyboard, for the on-screen guide. */
  label: string;
  group: 'left' | 'right' | 'rows';
  /** Plain words for the guide, e.g. "left column". */
  part: string;
  /** The turn in view terms: around the view's right, top or left axis. */
  along: FrameSlot;
  layer: -1 | 0 | 1;
  quarterTurns: 1 | -1;
}

const key = (
  code: string,
  group: TurnKey['group'],
  part: string,
  along: FrameSlot,
  layer: TurnKey['layer'],
  quarterTurns: TurnKey['quarterTurns'],
): TurnKey => ({ code, label: code.replace('Key', ''), group, part, along, layer, quarterTurns });

// In the opening view these are L M R' / F S B' / U' E D.
export const TURN_KEYS: TurnKey[] = [
  key('KeyQ', 'left', 'left column', 'right', -1, 1),
  key('KeyW', 'left', 'middle column', 'right', 0, 1),
  key('KeyE', 'left', 'right column', 'right', 1, 1),
  key('KeyI', 'right', 'left column', 'left', 1, -1),
  key('KeyO', 'right', 'middle column', 'left', 0, -1),
  key('KeyP', 'right', 'right column', 'left', -1, -1),
  key('KeyF', 'rows', 'top row', 'top', 1, 1),
  key('KeyG', 'rows', 'middle row', 'top', 0, 1),
  key('KeyH', 'rows', 'bottom row', 'top', -1, 1),
];

const BY_CODE = new Map(TURN_KEYS.map((k) => [k.code, k]));

/** The cube turn for a key in a view: a turn about -x by +q is a turn about x by -q. */
function keyTurn(k: TurnKey, frame: ViewFrame, reversed: boolean): Turn {
  const { axis, sign } = frame[k.along];
  return {
    axis,
    layer: (k.layer * sign) as Turn['layer'],
    quarterTurns: k.quarterTurns * sign * (reversed ? -1 : 1),
  };
}

/** The move for a key press in the current view, or null if the key isn't a turn key. */
export function turnKeyMove(code: string, reversed: boolean, frame: ViewFrame = DEFAULT_FRAME): Move | null {
  const found = BY_CODE.get(code);
  return found ? turnToMove(keyTurn(found, frame, reversed)) : null;
}

export interface KeyPress {
  key: TurnKey;
  /** Whether Space has to be held (or Reverse on). */
  reversed: boolean;
  /** Half turns are the same key twice. */
  times: 1 | 2;
}

/** Which key makes a move in the current view. Every layer has a key in every view. */
export function keyForMove(move: Move, frame: ViewFrame = DEFAULT_FRAME): KeyPress | null {
  const turn = moveToTurn(move);
  const slot = (['right', 'top', 'left'] as const).find((s) => frame[s].axis === turn.axis);
  if (!slot) return null;
  const { sign } = frame[slot];
  const found = TURN_KEYS.find((k) => k.along === slot && k.layer === turn.layer * sign);
  if (!found) return null;
  const quarters = (((turn.quarterTurns * sign) % 4) + 4) % 4;
  if (quarters === 2) return { key: found, reversed: false, times: 2 };
  const signed = quarters === 1 ? 1 : -1;
  return { key: found, reversed: signed !== found.quarterTurns, times: 1 };
}

/** "E", "Space + E" or "E twice"; on touch screens, what to tap instead. */
export function describeKeyPress({ key, reversed, times }: KeyPress, touch = false): string {
  if (touch) {
    const tap = `tap the lit button${times === 2 ? ' twice' : ''}`;
    return reversed ? `turn on Reverse, then ${tap}` : tap;
  }
  return `press ${reversed ? 'Space + ' : ''}${key.label}${times === 2 ? ' twice' : ''}`;
}
