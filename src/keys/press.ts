import { useCubeStore } from '../game/store';
import { useUi } from '../ui/uiStore';
import { turnKeyMove } from './keymap';

/** Whether the turn keys are reversed right now: Space held, or the on-screen reverse key on. */
export const keysReversed = () => {
  const { spaceHeld, reverseLatched } = useUi.getState();
  return spaceHeld || reverseLatched;
};

/**
 * Turns the layer for a turn key, typed or tapped. The keys are laid out for the corner view,
 * so if the view has been moved, the camera glides back to it first.
 */
export function pressTurnKey(code: string): boolean {
  const move = turnKeyMove(code, keysReversed());
  if (!move) return false;
  const ui = useUi.getState();
  if (ui.viewMoved) ui.requestViewReset();
  useCubeStore.getState().enqueue([move]);
  return true;
}
