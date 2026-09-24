import { useEffect } from 'react';
import {
  Box,
  CircleHelp,
  GraduationCap,
  Grid3x3,
  Lightbulb,
  Orbit,
  Redo2,
  RotateCcw,
  Settings,
  Shuffle,
  Undo2,
  WandSparkles,
} from 'lucide-react';
import { isSolved } from '../cube/model';
import { useCubeStore } from '../game/store';
import { requestHint, requestSolve, useAssist } from '../solver/assist';
import { prepareSolver, useSolverStatus } from '../solver/client';
import { startGuide, stopGuide, useGuide } from '../solver/guide';
import { IconButton } from './IconButton';
import { NARROW_SCREEN, useMediaQuery } from './useMediaQuery';
import { useUi } from './uiStore';

/** App name, help and settings. */
export function Brand() {
  const { setHelpOpen, setSettingsOpen } = useUi.getState();
  return (
    <div className="brand">
      <h1>3x3 Cube Puzzle</h1>
      <IconButton icon={CircleHelp} label="How to play" shortcut="?" onClick={() => setHelpOpen(true)} />
      <IconButton icon={Settings} label="Settings" onClick={() => setSettingsOpen(true)} />
    </div>
  );
}

/** Every action, grouped: game, editing, solver help, and view. */
export function Toolbar() {
  const mode = useCubeStore((s) => s.mode);
  const busy = useCubeStore((s) => s.active !== null);
  const hasHistory = useCubeStore((s) => s.history.length > 0);
  const canUndo = useCubeStore((s) => s.history.length > s.userStart);
  const canRedo = useCubeStore((s) => s.redoStack.length > 0);
  const solved = useCubeStore((s) => isSolved(s.cubies));
  const hasScramble = useCubeStore((s) => s.scramble.length > 0);
  const { scrambleCube, undo, redo, reset } = useCubeStore.getState();

  const pending = useAssist((s) => s.pending);
  const guiding = useGuide((s) => s.status !== 'off');
  const solverStatus = useSolverStatus((s) => s.status);

  const circularOpen = useUi((s) => s.circularOpen);
  const padOpen = useUi((s) => s.padOpen);
  const { toggleCircular, togglePad } = useUi.getState();
  const narrow = useMediaQuery(NARROW_SCREEN);

  // Build the solver's tables in the background as soon as a scramble makes them useful.
  useEffect(() => {
    if (hasScramble) prepareSolver();
  }, [hasScramble]);

  const playing = mode === 'play';
  const assistDisabled =
    !playing || busy || solved || guiding || pending !== null || solverStatus === 'error';
  const thinking = solverStatus === 'loading' ? 'Preparing the solver…' : 'Working it out…';

  // On phones the 2D view replaces the 3D one, so the button says which view it switches to.
  const viewButton =
    narrow && circularOpen
      ? { icon: Box, label: 'Show the 3D cube' }
      : { icon: Orbit, label: narrow ? 'Show the 2D view' : '2D view' };

  return (
    <nav className="toolbar" aria-label="Actions">
      <div className="tool-group" role="group" aria-label="Game">
        <IconButton icon={Shuffle} label="Scramble" shortcut="Space" primary onClick={scrambleCube} disabled={!playing} />
        <IconButton
          icon={RotateCcw}
          label="Reset to solved"
          onClick={reset}
          disabled={mode === 'resetting' || (!hasHistory && !busy)}
        />
      </div>
      <div className="tool-group" role="group" aria-label="Edit">
        <IconButton icon={Undo2} label="Undo" shortcut="Ctrl Z" onClick={undo} disabled={!playing || !canUndo} />
        <IconButton icon={Redo2} label="Redo" shortcut="Ctrl Shift Z" onClick={redo} disabled={!playing || !canRedo} />
      </div>
      <div className="tool-group" role="group" aria-label="Solver">
        <IconButton
          icon={Lightbulb}
          label={pending === 'hint' ? thinking : 'Hint: show the next move'}
          shortcut="H"
          onClick={requestHint}
          disabled={assistDisabled}
          busy={pending === 'hint'}
        />
        <IconButton
          icon={WandSparkles}
          label={pending === 'solve' ? thinking : 'Solve it for me'}
          onClick={requestSolve}
          disabled={assistDisabled}
          busy={pending === 'solve'}
        />
        <IconButton
          icon={GraduationCap}
          label={guiding ? 'Stop the guided solve' : 'Guided solve: learn by following each move'}
          onClick={guiding ? stopGuide : startGuide}
          disabled={!guiding && (!playing || busy || solverStatus === 'error')}
          pressed={guiding}
        />
      </div>
      <div className="tool-group" role="group" aria-label="View">
        <IconButton icon={viewButton.icon} label={viewButton.label} onClick={toggleCircular} pressed={narrow ? undefined : circularOpen} />
        <IconButton icon={Grid3x3} label="Move buttons" onClick={togglePad} pressed={padOpen} />
      </div>
    </nav>
  );
}
