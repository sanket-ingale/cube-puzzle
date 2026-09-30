import { create } from 'zustand';
import { createSolvedCube, isSolved, type Axis, type CubeState } from '../cube/model';
import { applyMove, applyMoves, invertMove, simplifyMoves, type Move } from '../cube/moves';
import { generateScramble } from '../cube/scramble';

export interface ActiveMove {
  /** Unique per queued move, so the animator can tell consecutive identical moves apart. */
  id: number;
  move: Move;
  /**
   * For a move finished by letting go of a drag: the angle the layer was already at, and the
   * angle to settle on (which may be a full turn away from the move's own, e.g. 270° for R').
   */
  from?: number;
  to?: number;
}

/** A layer being turned live by a drag, before it's let go. */
export interface Grab {
  /** Unique per grab, from the same sequence as move ids. */
  id: number;
  axis: Axis;
  layer: -1 | 0 | 1;
}

/**
 * `play` accepts input. The others lock input until their moves finish playing:
 * a scramble, the reset rewind, the solver finishing the cube, or a replay of a saved solve.
 */
export type Mode = 'play' | 'scrambling' | 'resetting' | 'solving' | 'replaying';

/** Competition inspection: 15 seconds to look before the clock starts on its own. */
export const INSPECTION_MS = 15_000;
const INSPECTION_KEY = 'cube-puzzle:inspection:v1';

interface CubeStore {
  /** The cube as currently drawn. Moves are committed here only when their animation ends. */
  cubies: CubeState;
  /** The move currently animating. */
  active: ActiveMove | null;
  queue: Move[];
  mode: Mode;
  /**
   * Every move applied or scheduled, oldest first. It is updated when a move is scheduled
   * rather than when it finishes, so rapid undo presses each undo a different move.
   */
  history: Move[];
  /** Index in `history` where the player's own moves begin, after the scramble. */
  userStart: number;
  redoStack: Move[];
  scramble: Move[];
  /** When the timed attempt started (the first move after the scramble), in ms since epoch. */
  timerStart: number | null;
  /** When inspection began (the scramble finished), if inspection is on and still running. */
  inspectionStart: number | null;
  /** True once the current scramble has been solved or given up, so it's recorded at most once. */
  attemptDone: boolean;
  /** True if a hint was used during the current attempt. */
  assisted: boolean;
  /** Set when the player solves a scrambled cube; cleared by the next move. */
  lastSolve: LastSolve | null;
  /** Player preference: give 15 seconds of inspection after each scramble. */
  inspection: boolean;
  /** The layer a drag is turning right now, if any. Other moves wait until it's let go. */
  grab: Grab | null;

  enqueue: (moves: Move[]) => void;
  scrambleCube: () => void;
  /**
   * Jumps to a solved cube and plays a given scramble, e.g. to set up a practice cube for a
   * lesson. Nothing is timed or recorded.
   */
  setUpCube: (moves: Move[]) => void;
  undo: () => void;
  redo: () => void;
  completeActive: () => void;
  reset: () => void;
  /** Records that a hint was shown, so the solve is kept out of the stats. */
  markAssisted: () => void;
  /** Plays the solver's moves to finish the cube. This gives up the current attempt. */
  autoSolve: (moves: Move[]) => void;
  /** Sets the cube to a saved solve's scramble and plays the player's moves back. */
  replay: (scramble: Move[], moves: Move[]) => void;
  setInspection: (on: boolean) => void;
  /** Starts turning a layer by hand. Only when nothing else is moving. */
  startGrab: (layer: Omit<Grab, 'id'>) => boolean;
  /**
   * Lets go of the layer. With a move, it settles from `from` to `to` (radians) and counts as
   * that move; without one, the grab simply ends (after the layer has sprung back).
   */
  releaseGrab: (release: { move: Move; from: number; to: number } | null) => void;
}

export interface LastSolve {
  moves: number;
  timeMs: number;
  scramble: Move[];
  /** The player's moves, for replaying the solve. */
  solution: Move[];
  assisted: boolean;
}

function loadInspection(): boolean {
  try {
    return localStorage.getItem(INSPECTION_KEY) === 'on';
  } catch {
    return false;
  }
}

function saveInspection(on: boolean) {
  try {
    localStorage.setItem(INSPECTION_KEY, on ? 'on' : 'off');
  } catch {
    // Not saved; the setting lasts for this visit.
  }
}

/**
 * When the clock started or should have started. With inspection running, the clock starts on
 * the first move, or on its own once the 15 seconds are up, whichever comes first.
 */
export function clockStart(s: Pick<CubeStore, 'timerStart' | 'inspectionStart'>, now: number) {
  if (s.timerStart !== null) return s.timerStart;
  if (s.inspectionStart !== null && now - s.inspectionStart >= INSPECTION_MS) {
    return s.inspectionStart + INSPECTION_MS;
  }
  return null;
}

let nextMoveId = 0;
const toActive = (move: Move): ActiveMove => ({ id: nextMoveId++, move });

/** Starts the first move right away if nothing is animating, otherwise queues everything. */
function schedule(s: Pick<CubeStore, 'active' | 'queue'>, moves: Move[]) {
  if (moves.length === 0) return { active: s.active, queue: s.queue };
  if (s.active) return { active: s.active, queue: [...s.queue, ...moves] };
  const [first, ...rest] = moves;
  return { active: toActive(first), queue: rest };
}

/** Fields that end any attempt in progress. */
const noAttempt = {
  timerStart: null,
  inspectionStart: null,
  attemptDone: false,
  assisted: false,
  lastSolve: null,
} as const;

export const useCubeStore = create<CubeStore>((set) => ({
  cubies: createSolvedCube(),
  active: null,
  queue: [],
  mode: 'play',
  history: [],
  userStart: 0,
  redoStack: [],
  scramble: [],
  ...noAttempt,
  inspection: loadInspection(),
  grab: null,

  enqueue: (moves) =>
    set((s) => {
      if (moves.length === 0 || s.mode !== 'play' || s.grab) return s;
      // The clock starts with the first move made on a fresh scramble.
      const startsAttempt = s.timerStart === null && s.scramble.length > 0 && !s.attemptDone;
      const now = Date.now();
      return {
        ...schedule(s, moves),
        history: [...s.history, ...moves],
        redoStack: [],
        lastSolve: null,
        timerStart: startsAttempt ? (clockStart(s, now) ?? now) : s.timerStart,
        inspectionStart: startsAttempt ? null : s.inspectionStart,
      };
    }),

  scrambleCube: () =>
    set((s) => {
      if (s.mode !== 'play' || s.grab) return s;
      const moves = generateScramble();
      const history = [...s.history, ...moves];
      return {
        ...schedule(s, moves),
        ...noAttempt,
        mode: 'scrambling',
        history,
        userStart: history.length,
        redoStack: [],
        scramble: moves,
      };
    }),

  setUpCube: (moves) =>
    set((s) => {
      if (s.mode !== 'play' || s.active || s.grab) return s;
      return {
        ...schedule({ active: null, queue: [] }, moves),
        ...noAttempt,
        attemptDone: true,
        cubies: createSolvedCube(),
        mode: moves.length > 0 ? 'scrambling' : 'play',
        history: [...moves],
        userStart: moves.length,
        redoStack: [],
        scramble: [],
      };
    }),

  undo: () =>
    set((s) => {
      // The scramble itself can't be undone, only the player's moves after it.
      if (s.mode !== 'play' || s.grab || s.history.length <= s.userStart) return s;
      const last = s.history[s.history.length - 1];
      return {
        ...schedule(s, [invertMove(last)]),
        history: s.history.slice(0, -1),
        redoStack: [...s.redoStack, last],
        lastSolve: null,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.mode !== 'play' || s.grab || s.redoStack.length === 0) return s;
      const move = s.redoStack[s.redoStack.length - 1];
      return {
        ...schedule(s, [move]),
        history: [...s.history, move],
        redoStack: s.redoStack.slice(0, -1),
      };
    }),

  completeActive: () =>
    set((s) => {
      if (!s.active) return s;
      const cubies = applyMove(s.cubies, s.active.move);
      const [next, ...rest] = s.queue;
      if (next) return { cubies, active: toActive(next), queue: rest };

      const settled = { cubies, active: null, queue: [], mode: 'play' as const };
      // Inspection begins once the scramble has finished playing.
      if (s.mode === 'scrambling') {
        return { ...settled, inspectionStart: s.inspection && s.scramble.length > 0 ? Date.now() : null };
      }

      // Only a settled cube counts: passing through solved mid-sequence doesn't. Each scramble
      // is recorded once; solving it again after undoing doesn't start a new attempt.
      const solvedScramble =
        s.mode === 'play' && s.scramble.length > 0 && !s.attemptDone && isSolved(cubies);
      if (!solvedScramble) return settled;
      const now = Date.now();
      return {
        ...settled,
        attemptDone: true,
        timerStart: null,
        inspectionStart: null,
        lastSolve: {
          moves: s.history.length - s.userStart,
          timeMs: now - (clockStart(s, now) ?? now),
          scramble: s.scramble,
          solution: s.history.slice(s.userStart),
          assisted: s.assisted,
        },
      };
    }),

  /**
   * Animates back to solved by playing the inverse of every move, newest first. Queued moves
   * cancel against their own inverses, so only the active move and committed ones replay.
   */
  reset: () =>
    set((s) => {
      if (s.mode === 'resetting') return s;
      const rewind = [...s.history].reverse().map(invertMove);
      const moves = simplifyMoves([...s.queue, ...rewind]);
      const cleared = { ...noAttempt, history: [], userStart: 0, redoStack: [], scramble: [], grab: null };

      if (s.active) return { ...cleared, mode: 'resetting', queue: moves };
      if (moves.length === 0) return { ...cleared, mode: 'play' };
      return { ...cleared, mode: 'resetting', ...schedule(s, moves) };
    }),

  markAssisted: () =>
    set((s) => (s.scramble.length > 0 && !s.attemptDone ? { assisted: true } : s)),

  autoSolve: (moves) =>
    set((s) => {
      if (s.mode !== 'play' || s.active || s.grab || moves.length === 0) return s;
      return {
        ...schedule(s, moves),
        mode: 'solving',
        history: [...s.history, ...moves],
        redoStack: [],
        // Letting the solver finish gives up the timed attempt: nothing is recorded.
        attemptDone: s.scramble.length > 0 ? true : s.attemptDone,
        timerStart: null,
        inspectionStart: null,
        lastSolve: null,
      };
    }),

  replay: (scramble, moves) =>
    set((s) => {
      if (s.mode !== 'play' || s.active || s.grab) return s;
      // Jump straight to the scrambled position, then play the solve at a watchable pace.
      const history = [...scramble, ...moves];
      return {
        ...schedule({ active: null, queue: [] }, moves),
        ...noAttempt,
        attemptDone: true,
        cubies: applyMoves(createSolvedCube(), scramble),
        mode: moves.length > 0 ? 'replaying' : 'play',
        history,
        userStart: scramble.length,
        redoStack: [],
        scramble,
      };
    }),

  startGrab: ({ axis, layer }) => {
    const s = useCubeStore.getState();
    if (s.mode !== 'play' || s.active || s.queue.length > 0 || s.grab) return false;
    set({ grab: { id: nextMoveId++, axis, layer } });
    return true;
  },

  releaseGrab: (release) =>
    set((s) => {
      if (!s.grab) return s;
      if (!release) return { grab: null };
      // Same bookkeeping as any other move (history, redo, the timer), minus the start.
      const startsAttempt = s.timerStart === null && s.scramble.length > 0 && !s.attemptDone;
      const now = Date.now();
      return {
        grab: null,
        active: { id: nextMoveId++, move: release.move, from: release.from, to: release.to },
        history: [...s.history, release.move],
        redoStack: [],
        lastSolve: null,
        timerStart: startsAttempt ? (clockStart(s, now) ?? now) : s.timerStart,
        inspectionStart: startsAttempt ? null : s.inspectionStart,
      };
    }),

  setInspection: (on) => {
    saveInspection(on);
    set((s) => ({ inspection: on, inspectionStart: on ? s.inspectionStart : null }));
  },
}));
