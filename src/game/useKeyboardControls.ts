import { useEffect } from 'react';
import { requestHint } from '../solver/assist';
import { pressTurnKey } from '../keys/press';
import { turnKeyMove } from '../keys/keymap';
import { useUi } from '../ui/uiStore';
import { useCubeStore } from './store';

const onControl = (target: HTMLElement | null) =>
  !!target?.closest('button, [role="button"], [role="switch"], [role="radio"], summary, a');

/**
 * Keyboard controls.
 *
 * Q W E, I O P and F G H turn columns and rows as seen in the corner view, and holding Space
 * turns them the other way. Enter scrambles, N shows a hint, Esc brings the view back to the
 * corner, Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes, and ? opens the help.
 */
export function useKeyboardControls() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      // A dialog is open: leave the keyboard to it (Escape closes it natively).
      if (document.querySelector('dialog[open]')) return;

      const game = useCubeStore.getState();
      const ui = useUi.getState();
      const key = e.key.toLowerCase();

      if (e.metaKey || e.ctrlKey) {
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) game.redo();
          else game.undo();
        } else if (key === 'y') {
          e.preventDefault();
          game.redo();
        }
        return;
      }
      if (e.altKey) return;

      // Space is a modifier: never a page scroll or a button press.
      if (e.code === 'Space') {
        e.preventDefault();
        if (!ui.spaceHeld) ui.setSpaceHeld(true);
        return;
      }
      if (e.repeat) {
        if (turnKeyMove(e.code, false)) e.preventDefault();
        return;
      }
      // Enter on a focused button presses that button, so only scramble from elsewhere.
      if (e.key === 'Enter' && !onControl(target)) {
        e.preventDefault();
        game.scrambleCube();
        return;
      }
      if (e.key === 'Escape') {
        if (ui.viewMoved) {
          e.preventDefault();
          ui.requestViewReset();
        }
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        ui.setHelpOpen(true);
        return;
      }
      if (e.code === 'KeyN') {
        e.preventDefault();
        void requestHint();
        return;
      }
      if (turnKeyMove(e.code, false)) {
        e.preventDefault();
        // A clicked button keeps focus, where the next Enter would press it again.
        if (onControl(target)) target!.blur();
        pressTurnKey(e.code);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && useUi.getState().spaceHeld) {
        e.preventDefault();
        useUi.getState().setSpaceHeld(false);
      }
    };
    // Switching windows while holding Space would otherwise leave it stuck "held".
    const onBlur = () => useUi.getState().spaceHeld && useUi.getState().setSpaceHeld(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}
