import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { toFacelets, type FaceletState } from '../cube/facelets';
import { invertMove, type Move } from '../cube/moves';
import { generateScramble } from '../cube/scramble';
import { createSolvedCube, isSolved } from '../cube/model';
import { applyMoves } from '../cube/moves';
import { useCubeStore } from '../game/store';
import { sameFrame } from '../keys/frame';
import { glideToFrame, nearestOf } from '../scene/view';
import { solve } from '../solver/client';
import { useUi } from '../ui/uiStore';
import { detectStage, findPiece, planSolve, planStep, realMoves, STAGE_INDEX, type Stage, type Step } from './lbl';
import { applyToFacelets, framesWithTop } from './view';

/**
 * Learn mode: the beginner's method taught one stage at a time. The player does the turning;
 * the lesson watches the cube, and help comes in steps only when asked for:
 *
 *   rung 0  nothing: have a go
 *   rung 1  which piece to work on (lit up)
 *   rung 2  where it goes (its spot lit up too)
 *   rung 3  how: the holding, a setup and the algorithm, followed move by move
 *
 * "Show me" plays the rest of the step. Every change to the cube is checked against the method,
 * so whatever the player does, the next step is planned from where the cube really is.
 */

export type LessonId = Exclude<Stage, 'done'>;
export type Rung = 0 | 1 | 2 | 3;

interface PathPoint {
  key: string;
  /** Moves of the step made by this point (a half turn counts once both quarters are in). */
  made: number;
}

interface Learn {
  status: 'off' | 'menu' | 'lesson';
  lesson: LessonId | null;
  step: Step | null;
  /** The real moves of the step, unmerged, as shown and followed. */
  moves: Move[];
  path: PathPoint[];
  made: number;
  rung: Rung;
  /** The lesson's stage has just been finished. */
  stageDone: boolean;
  /** Where the cube is in the method right now. */
  cubeStage: Stage;
  preparing: boolean;
  /** Pieces or cases done in this lesson, for encouragement. */
  steps: number;
  completed: LessonId[];
}

const PROGRESS_KEY = 'cube-puzzle:learn:v1';

function loadCompleted(): LessonId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is LessonId => typeof x === 'string' && x in STAGE_INDEX) : [];
  } catch {
    return [];
  }
}

function saveCompleted(completed: LessonId[]) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(completed));
  } catch {
    // Not saved; progress lasts for this visit.
  }
}

export const useLearn = create<Learn>(() => ({
  status: 'off',
  lesson: null,
  step: null,
  moves: [],
  path: [],
  made: 0,
  rung: 0,
  stageDone: false,
  cubeStage: 'done',
  preparing: false,
  steps: 0,
  completed: loadCompleted(),
}));

const cubeFacelets = (): FaceletState => toFacelets(useCubeStore.getState().cubies);
const key = (f: FaceletState) => f.join('');

const idle = () => {
  const s = useCubeStore.getState();
  return s.mode === 'play' && s.active === null && s.queue.length === 0 && !s.grab;
};

/** The states a step passes through, including the halfway point of each half turn. */
function pathFor(start: FaceletState, moves: Move[]): PathPoint[] {
  const points: PathPoint[] = [{ key: key(start), made: 0 }];
  let s = start;
  moves.forEach((move, i) => {
    if (move.amount === 2) {
      for (const amount of [1, -1] as const) {
        points.push({ key: key(applyToFacelets(s, { face: move.face, amount })), made: i });
      }
    }
    s = applyToFacelets(s, move);
    points.push({ key: key(s), made: i + 1 });
  });
  return points;
}

const samePiece = (a: Step | null, b: Step) => !!a && a.kind === b.kind && a.colours.join() === b.colours.join();

/** Plans the next step from the cube as it is. */
function replan(keepRung: boolean) {
  const f = cubeFacelets();
  const learn = useLearn.getState();
  const info = detectStage(f);
  const lesson = learn.lesson;
  if (!lesson) return;

  // The lesson's stage is done: celebrate, and remember it.
  if (STAGE_INDEX[info.stage] > STAGE_INDEX[lesson]) {
    const completed = learn.completed.includes(lesson) ? learn.completed : [...learn.completed, lesson];
    saveCompleted(completed);
    useLearn.setState({ step: null, moves: [], path: [], made: 0, rung: 0, stageDone: true, cubeStage: info.stage, completed });
    return;
  }

  const step = planStep(f, useUi.getState().viewFrame);
  if (!step) return;
  const moves = realMoves(step, true);
  const rung = keepRung && samePiece(learn.step, step) ? learn.rung : 0;
  useLearn.setState({ step, moves, path: pathFor(f, moves), made: 0, rung, stageDone: false, cubeStage: info.stage });
  if (rung === 3 && !sameFrame(step.frame, useUi.getState().viewFrame)) glideToFrame(step.frame);
}

/** Turns the cube to the nearest way of holding it with yellow on top. */
function holdYellowUp() {
  const frame = nearestOf(framesWithTop(cubeFacelets(), 'D'));
  if (frame) glideToFrame(frame);
}

export function openLearn() {
  useLearn.setState({ status: 'menu', stageDone: false, cubeStage: detectStage(cubeFacelets()).stage });
}

export function closeLearn() {
  useLearn.setState({ status: 'off', lesson: null, step: null, moves: [], path: [], rung: 0, stageDone: false, preparing: false });
}

export function backToLessons() {
  useLearn.setState({ status: 'menu', lesson: null, step: null, moves: [], path: [], rung: 0, stageDone: false, cubeStage: detectStage(cubeFacelets()).stage });
}

/** Practice cubes: a random cube solved up to the lesson's stage, set up with a short scramble. */
async function practiceScramble(lesson: LessonId): Promise<Move[]> {
  const random = generateScramble();
  if (lesson === 'cross') return random;
  const start = toFacelets(applyMoves(createSolvedCube(), random));
  const result = planSolve(start, lesson);
  if (!result) return random;
  // The solver finds a short way back from that cube; played backwards, it sets the cube up.
  const back = await solve(key(result.state));
  return [...back].reverse().map(invertMove);
}

/**
 * Starts a lesson. With `practice`, sets up a fresh cube with the earlier stages done;
 * otherwise carries on with the cube as it is.
 */
export async function startLesson(lesson: LessonId, practice: boolean) {
  const game = useCubeStore.getState();
  if (game.mode !== 'play' || game.active) return;
  useLearn.setState({ status: 'lesson', lesson, step: null, moves: [], path: [], made: 0, rung: 0, stageDone: false, steps: 0 });
  // Learning isn't timed: a lesson's solve stays out of the stats.
  game.markAssisted();

  if (practice || isSolved(game.cubies)) {
    useLearn.setState({ preparing: true });
    try {
      const moves = await practiceScramble(lesson);
      useCubeStore.getState().setUpCube(moves);
    } catch {
      useCubeStore.getState().setUpCube(generateScramble());
    }
    // Planning waits for the set-up to finish playing (see the tracker).
    return;
  }
  holdYellowUp();
  replan(false);
}

export function nextLesson() {
  const { lesson } = useLearn.getState();
  if (!lesson) return;
  const next = STAGE_ORDER[STAGE_INDEX[lesson] + 1];
  if (!next) {
    backToLessons();
    return;
  }
  // The cube is already at the next stage, so carry straight on with it.
  void startLesson(next, false);
}

const STAGE_ORDER: LessonId[] = ['cross', 'corners', 'middle', 'yellowCross', 'yellowEdges', 'cornerPlace', 'cornerTwist'];

/** One more rung of help. The last rung turns the cube to how the step is held. */
export function moreHelp() {
  const { rung, step } = useLearn.getState();
  if (!step || rung >= 3) return;
  const next = (rung + 1) as Rung;
  useLearn.setState({ rung: next });
  if (next === 3) glideToFrame(step.frame);
}

/** Plays the rest of the step for the player, at a pace that can be followed. */
export function showMe() {
  const { step, moves, made } = useLearn.getState();
  if (!step || !idle()) return;
  useLearn.setState({ rung: 3 });
  glideToFrame(step.frame);
  useCubeStore.getState().autoSolve(moves.slice(made));
}

/** The next move to make while following rung 3, for the arrow on the cube and the keys. */
export function useLearnNextMove(): Move | null {
  return useLearn((s) => (s.status === 'lesson' && s.rung === 3 && s.step ? (s.moves[s.made] ?? null) : null));
}

/** Follows the cube while a lesson is on. Returns the unsubscribe function. */
export function subscribeLearn(): () => void {
  return useCubeStore.subscribe((state, previous) => {
    const learn = useLearn.getState();
    if (learn.status !== 'lesson') return;
    if (state.mode === 'resetting' || state.mode === 'replaying') {
      closeLearn();
      return;
    }
    if (state.cubies === previous.cubies && state.mode === previous.mode) return;
    if (!idle()) return;

    // A practice cube has just been set up: hold it yellow side up and plan.
    if (learn.preparing) {
      useLearn.setState({ preparing: false });
      holdYellowUp();
      replan(false);
      return;
    }

    const now = key(cubeFacelets());
    const point = learn.path.find((p) => p.key === now);
    if (point && point.made < learn.moves.length) {
      useLearn.setState({ made: point.made });
      return;
    }
    if (point) {
      // The step is done: on to the next piece or case, with help hidden again.
      useLearn.setState({ steps: learn.steps + 1 });
      replan(false);
      return;
    }
    // Something else happened: plan from here, keeping the help level for the same piece.
    replan(true);
  });
}

/** Mounts learn mode's tracking. Once, near the app root. */
export function useLearnTracker() {
  useEffect(() => subscribeLearn(), []);
}

export { STAGE_ORDER };

export type Mark = 'piece' | 'target';

/**
 * Stickers to light up for the current help: the piece being worked on (from the first rung,
 * followed as it moves) and the spot it's going to (from the second).
 */
export function useLearnMarks(): Map<number, Mark> {
  const step = useLearn((s) => (s.status === 'lesson' ? s.step : null));
  const rung = useLearn((s) => s.rung);
  const cubies = useCubeStore((s) => s.cubies);
  return useMemo(() => {
    const marks = new Map<number, Mark>();
    if (!step || rung < 1) return marks;
    if (rung >= 2) for (const i of step.target) marks.set(i, 'target');
    const piece = step.colours.length >= 2 ? findPiece(toFacelets(cubies), step.colours) : step.piece;
    for (const i of piece) marks.set(i, 'piece');
    return marks;
  }, [step, rung, cubies]);
}
