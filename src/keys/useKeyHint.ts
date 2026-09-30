import type { Move } from '../cube/moves';
import { useUi } from '../ui/uiStore';
import { TOUCH_SCREEN, useMediaQuery } from '../ui/useMediaQuery';
import { describeKeyPress, keyForMove } from './keymap';

/** What to press (or tap) for a move in the current view, e.g. "press Space + Q". */
export function useKeyHint(move: Move | null): string | null {
  const frame = useUi((s) => s.viewFrame);
  const touch = useMediaQuery(TOUCH_SCREEN);
  const press = move ? keyForMove(move, frame) : null;
  return press ? describeKeyPress(press, touch) : null;
}
