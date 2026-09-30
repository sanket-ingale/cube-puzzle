import { useCubeStore } from '../game/store';
import { snapView } from '../scene/view';
import { useUi } from '../ui/uiStore';
import { moveToTurn } from '../cube/moves';
import { turnKeyMove } from './keymap';

/** Whether the turn keys are reversed right now: Space held, or the on-screen Reverse on. */
export const keysReversed = () => {
  const { spaceHeld, reverseLatched } = useUi.getState();
  return spaceHeld || reverseLatched;
};

/**
 * Turns the layer for a turn key, typed or tapped. The keys work in corner views, so if the
 * cube has been turned away from one, it settles on the nearest corner first and the key is
 * read in that view.
 */
export function pressTurnKey(code: string): boolean {
  const ui = useUi.getState();
  const frame = ui.viewMoved ? snapView() : ui.viewFrame;
  const move = turnKeyMove(code, keysReversed(), frame);
  if (!move) return false;
  useCubeStore.getState().enqueue([move]);
  flashLayer(move, false);
  return true;
}

/** How long a pressed key's layer stays lit. */
export const FLASH_MS = 650;
let flashTimer = 0;

/** Lights up the layer a move turns: briefly, or until cleared when `hold` (a hovered key). */
export function flashLayer(move: Parameters<typeof moveToTurn>[0], hold: boolean) {
  const { axis, layer } = moveToTurn(move);
  useUi.getState().setFlash({ axis, layer, at: performance.now(), hold });
  window.clearTimeout(flashTimer);
  if (!hold) flashTimer = window.setTimeout(() => useUi.getState().setFlash(null), FLASH_MS);
}

/** What a turn key would move in the current view, lit while the pointer is over it. */
export function previewTurnKey(code: string | null) {
  const ui = useUi.getState();
  if (code === null) {
    if (ui.flash?.hold) ui.setFlash(null);
    return;
  }
  const move = turnKeyMove(code, keysReversed(), ui.viewFrame);
  if (move) flashLayer(move, true);
}
