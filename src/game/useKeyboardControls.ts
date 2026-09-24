import { useEffect } from 'react';
import { MOVE_FACES, type MoveFace } from '../cube/moves';
import { requestHint } from '../solver/assist';
import { useUi } from '../ui/uiStore';
import { useCubeStore } from './store';

/**
 * Letter keys map to moves: R turns R, Shift+R turns R'. Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z
 * or Ctrl+Y redoes. Space scrambles, H asks for a hint and ? opens the help.
 */
export function useKeyboardControls() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      // A dialog is open: leave the keyboard to it (Escape closes it natively).
      if (document.querySelector('dialog[open]')) return;

      const game = useCubeStore.getState();
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
      if (e.repeat || e.altKey) return;

      if (e.key === '?') {
        e.preventDefault();
        useUi.getState().setHelpOpen(true);
        return;
      }
      // Space on a focused button presses that button, so only scramble from elsewhere.
      if (e.key === ' ' && !target?.closest('button, [role="button"], summary')) {
        e.preventDefault();
        game.scrambleCube();
        return;
      }
      if (key === 'h') {
        e.preventDefault();
        void requestHint();
        return;
      }

      const face = key.toUpperCase() as MoveFace;
      if (!MOVE_FACES.includes(face)) return;
      e.preventDefault();
      game.enqueue([{ face, amount: e.shiftKey ? -1 : 1 }]);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
