import { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  Box,
  CircleHelp,
  GraduationCap,
  Lightbulb,
  Redo2,
  RotateCcw,
  Scan,
  Settings,
  Shuffle,
  Sparkles,
  Undo2,
  WandSparkles,
  type LucideProps,
} from 'lucide-react';
import { isSolved } from '../cube/model';
import { useCubeStore } from '../game/store';
import { requestHint, requestSolve, useAssist } from '../solver/assist';
import { prepareSolver, useSolverStatus } from '../solver/client';
import { closeLearn, openLearn, useLearn } from '../learn/learn';
import { BrandMark } from './BrandMark';
import { IconButton, type TipPlacement } from './IconButton';
import { NARROW_SCREEN, useMediaQuery } from './useMediaQuery';
import { useUi } from './uiStore';
import { CirclesIcon } from './CirclesIcon';
import { snapView } from '../scene/view';

export function Brand() {
  return (
    <div className="brand">
      <BrandMark />
      <h1>3x3 Cube Puzzle</h1>
    </div>
  );
}

/** Help and settings: needed rarely, so they're the quietest buttons, in the corner. */
export function MetaButtons({ tip = 'below-end' }: { tip?: TipPlacement }) {
  const { setHelpOpen, setSettingsOpen } = useUi.getState();
  return (
    <div className="meta" role="group" aria-label="Help and settings">
      <IconButton icon={CircleHelp} label="How to play" shortcut="?" variant="flat" tip={tip} onClick={() => setHelpOpen(true)} />
      <IconButton icon={Settings} label="Settings" variant="flat" tip={tip} onClick={() => setSettingsOpen(true)} />
    </div>
  );
}

/** Which view is showing: on phones the 2D view takes the cube's place, so it's one or the other. */
export function ViewSwitch() {
  const circularOpen = useUi((s) => s.circularOpen);
  const { toggleCircular } = useUi.getState();
  const narrow = useMediaQuery(NARROW_SCREEN);

  if (narrow) {
    return (
      <div className="button-tray" role="group" aria-label="View">
        <IconButton icon={Box} label="3D cube" variant="tray" tip="below-end" pressed={!circularOpen} onClick={() => circularOpen && toggleCircular()} />
        <IconButton icon={CirclesIcon} label="2D view" variant="tray" tip="below-end" pressed={circularOpen} onClick={() => !circularOpen && toggleCircular()} />
      </div>
    );
  }

  return (
    <div className="button-tray" role="group" aria-label="View">
      <IconButton icon={CirclesIcon} label="2D view" variant="tray" tip="below-end" pressed={circularOpen} onClick={toggleCircular} />
    </div>
  );
}

/** Shown once the cube has been turned away from a corner view; settles it on the nearest one. */
export function ResetViewButton() {
  return (
    <IconButton
      icon={Scan}
      label="Reset view"
      shortcut="Esc"
      text="Reset view"
      tip="below-end"
      onClick={() => snapView()}
    />
  );
}

interface AssistItem {
  icon: ComponentType<LucideProps>;
  label: string;
  /** The shorter name shown in the phone menu. */
  name: string;
  shortcut?: string;
  onClick: () => void;
  disabled: boolean;
  busy?: boolean;
  pressed?: boolean;
}

/** Hint, solve and learn mode, with whether each can be used right now. */
function useAssistItems(): AssistItem[] {
  const mode = useCubeStore((s) => s.mode);
  const busy = useCubeStore((s) => s.active !== null);
  const solved = useCubeStore((s) => isSolved(s.cubies));
  const pending = useAssist((s) => s.pending);
  const learning = useLearn((s) => s.status !== 'off');
  const solverStatus = useSolverStatus((s) => s.status);

  const playing = mode === 'play';
  const disabled = !playing || busy || solved || learning || pending !== null || solverStatus === 'error';
  const thinking = solverStatus === 'loading' ? 'Preparing the solver…' : 'Working it out…';

  return [
    {
      icon: Lightbulb,
      label: pending === 'hint' ? thinking : 'Hint: show the next move',
      name: pending === 'hint' ? thinking : 'Hint',
      shortcut: 'N',
      onClick: () => void requestHint(),
      disabled,
      busy: pending === 'hint',
    },
    {
      icon: WandSparkles,
      label: pending === 'solve' ? thinking : 'Solve it for me',
      name: pending === 'solve' ? thinking : 'Solve it for me',
      onClick: () => void requestSolve(),
      disabled,
      busy: pending === 'solve',
    },
    {
      icon: GraduationCap,
      label: learning ? 'Stop learning' : 'Learn to solve: the beginner’s method, step by step',
      name: learning ? 'Stop learning' : 'Learn to solve',
      onClick: learning ? closeLearn : openLearn,
      disabled: !learning && (!playing || busy),
      pressed: learning,
    },
  ];
}

/** On phones the three solver helpers share one button that opens a small menu. */
function AssistMenu() {
  const items = useAssistItems();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const anyBusy = items.some((item) => item.busy);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="menu-anchor" ref={root}>
      <IconButton icon={Sparkles} label="Help me solve" tip="above-end" busy={anyBusy} expanded={open} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div className="menu" role="menu" aria-label="Help me solve">
          {items.map(({ icon: Icon, name, onClick, disabled, pressed }, index) => (
            <button
              key={index}
              type="button"
              role="menuitem"
              className={pressed ? 'menu-item on' : 'menu-item'}
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onClick();
              }}
            >
              <Icon size={20} strokeWidth={2.25} aria-hidden="true" />
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The actions, in order of importance: Scramble in the middle and largest, the play controls
 * beside it, and the solver helpers in a lighter tray (or one menu button on phones).
 */
export function Dock() {
  const mode = useCubeStore((s) => s.mode);
  const busy = useCubeStore((s) => s.active !== null);
  const hasHistory = useCubeStore((s) => s.history.length > 0);
  const canUndo = useCubeStore((s) => s.history.length > s.userStart);
  const canRedo = useCubeStore((s) => s.redoStack.length > 0);
  const hasScramble = useCubeStore((s) => s.scramble.length > 0);
  const { scrambleCube, undo, redo, reset } = useCubeStore.getState();
  const narrow = useMediaQuery(NARROW_SCREEN);
  const assist = useAssistItems();

  // Build the solver's tables in the background as soon as a scramble makes them useful.
  useEffect(() => {
    if (hasScramble) prepareSolver();
  }, [hasScramble]);

  const playing = mode === 'play';
  const tip: TipPlacement = 'above';
  const resetButton = (
    <IconButton
      icon={RotateCcw}
      label="Reset to solved"
      tip={narrow ? 'above-end' : tip}
      onClick={reset}
      disabled={mode === 'resetting' || (!hasHistory && !busy)}
    />
  );
  const undoButton = <IconButton icon={Undo2} label="Undo" shortcut="Ctrl Z" tip={tip} onClick={undo} disabled={!playing || !canUndo} />;
  const redoButton = <IconButton icon={Redo2} label="Redo" shortcut="Ctrl Shift Z" tip={tip} onClick={redo} disabled={!playing || !canRedo} />;
  const scrambleButton = (
    <IconButton icon={Shuffle} label="Scramble" shortcut="Enter" text="Scramble" tip={tip} primary onClick={scrambleCube} disabled={!playing} />
  );

  if (narrow) {
    return (
      <nav className="dock" aria-label="Actions">
        {undoButton}
        {redoButton}
        {scrambleButton}
        <AssistMenu />
        {resetButton}
      </nav>
    );
  }

  return (
    <nav className="dock" aria-label="Actions">
      <div className="dock-group" role="group" aria-label="Play">
        {resetButton}
        {undoButton}
        {redoButton}
      </div>
      {scrambleButton}
      <div className="button-tray" role="group" aria-label="Help me solve">
        {assist.map(({ icon, label, shortcut, onClick, disabled, busy: working, pressed }, index) => (
          <IconButton
            key={index}
            icon={icon}
            label={label}
            shortcut={shortcut}
            variant="tray"
            tip={tip}
            onClick={onClick}
            disabled={disabled}
            busy={working}
            pressed={pressed}
          />
        ))}
      </div>
    </nav>
  );
}
