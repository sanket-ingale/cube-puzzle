import { useEffect } from 'react';
import { create } from 'zustand';
import { isSolved } from '../cube/model';
import type { Move, MoveFace } from '../cube/moves';
import { useCubeStore } from '../game/store';
import { solve } from './client';
import { solverInput } from './facelets';

/**
 * The guided solve: a coach that walks a first-timer through a solution one move at a time.
 * It plans a short solution, waits for each move, and plans again from wherever the cube is if
 * the player does something else. It teaches the controls and notation, not a human method.
 */

/** `finishing`: every step is made, and the last turns are still animating. */
export type GuideStatus = 'off' | 'planning' | 'ready' | 'finishing' | 'done' | 'error';

interface Guide {
  status: GuideStatus;
  /** The moves still to make, next one first. */
  plan: Move[];
  /** Moves the player has made while guided, for the progress count. */
  made: number;
  /** True after the player went their own way and a new route was worked out. */
  rerouted: boolean;
}

export const useGuide = create<Guide>(() => ({ status: 'off', plan: [], made: 0, rerouted: false }));

const idle = () => {
  const s = useCubeStore.getState();
  return s.mode === 'play' && s.active === null && s.queue.length === 0;
};

let planning = false;

/** Works out a route from the cube as it sits now (once nothing is moving). */
async function plan(rerouted: boolean) {
  if (planning || !idle()) return;
  planning = true;
  useGuide.setState({ status: 'planning', rerouted });
  const { cubies, history } = useCubeStore.getState();
  try {
    const moves = await solve(solverInput(cubies));
    // If the player moved while this was being worked out, plan again from there.
    if (useCubeStore.getState().history !== history) {
      planning = false;
      return plan(true);
    }
    useGuide.setState({ status: moves.length ? 'ready' : 'done', plan: moves });
  } catch {
    useGuide.setState({ status: 'error' });
  } finally {
    planning = false;
  }
}

/** Starts the guide: scrambles a solved cube first, then plans the first route. */
export function startGuide() {
  const game = useCubeStore.getState();
  if (game.mode !== 'play' || game.active) return;
  useGuide.setState({ status: 'planning', plan: [], made: 0, rerouted: false });
  if (isSolved(game.cubies)) game.scrambleCube();
  // A guided solve is saved with the hint tag, so it stays out of the stats.
  useCubeStore.getState().markAssisted();
  void plan(false);
}

export function stopGuide() {
  useGuide.setState({ status: 'off', plan: [], made: 0, rerouted: false });
}

/**
 * What a move does to the plan: the next step done, part of a half turn done, or a detour.
 * Pure, so it can be tested on its own.
 */
export function advancePlan(plan: Move[], move: Move): Move[] | null {
  const [next, ...rest] = plan;
  if (!next || next.face !== move.face) return null;
  if (next.amount === move.amount) return rest;
  // Half of a half turn: the remaining quarter goes the same way as the one just made.
  if (next.amount === 2 && move.amount !== 2) return [{ face: move.face, amount: move.amount }, ...rest];
  return null;
}

/** Follows the game while the guide is on. Returns the unsubscribe function. */
export function subscribeGuide(): () => void {
  return useCubeStore.subscribe((state, previous) => {
    const guide = useGuide.getState();
    if (guide.status === 'off') return;

    // Resetting, handing over to the solver or replaying ends the guide.
    if (state.mode === 'resetting' || state.mode === 'solving' || state.mode === 'replaying') {
      stopGuide();
      return;
    }
    // A scramble is still playing (the guide's own, when starting from solved).
    if (state.mode === 'scrambling') return;

    // Finished: playing on afterwards ends the guide rather than starting a new route.
    if (guide.status === 'done' || guide.status === 'finishing') {
      // Only call it solved once the last turns have actually landed.
      if (guide.status === 'finishing' && state.history === previous.history) {
        const settledNow = state.mode === 'play' && state.active === null && state.queue.length === 0;
        if (settledNow) useGuide.setState({ status: 'done' });
        return;
      }
      if (state.history !== previous.history) stopGuide();
      return;
    }

    if (state.history !== previous.history && previous.mode === 'play') {
      const added = state.history.length === previous.history.length + 1;
      const move = state.history[state.history.length - 1];
      const next = added && guide.status === 'ready' ? advancePlan(guide.plan, move) : null;
      if (next) {
        useGuide.setState({ plan: next, made: guide.made + 1, status: next.length ? 'ready' : 'finishing' });
      } else {
        // A different move or an undo: plan a new route once the cube has settled.
        useGuide.setState({ status: 'planning', plan: [], made: guide.made + (added ? 1 : 0) });
      }
    }

    const settled = state.mode === 'play' && state.active === null && state.queue.length === 0;
    if (settled && useGuide.getState().status === 'planning') void plan(guide.made > 0);
  });
}

/** Mounts the guide's tracking. Once, near the app root. */
export function useGuideTracker() {
  useEffect(() => subscribeGuide(), []);
}

/** Plain-language names for each layer, and where to look from to judge clockwise. */
const LAYER_WORDS: Record<MoveFace, { layer: string; view: string }> = {
  U: { layer: 'top layer', view: 'from above' },
  D: { layer: 'bottom layer', view: 'from below' },
  L: { layer: 'left layer', view: 'from the left' },
  R: { layer: 'right layer', view: 'from the right' },
  F: { layer: 'front layer', view: 'from the front' },
  B: { layer: 'back layer', view: 'from behind' },
  M: { layer: 'middle slice between left and right', view: 'from the left' },
  E: { layer: 'middle slice between top and bottom', view: 'from below' },
  S: { layer: 'middle slice between front and back', view: 'from the front' },
};

/** e.g. "Turn the right layer clockwise, as seen from the right." */
export function describeMove({ face, amount }: Move): string {
  const { layer, view } = LAYER_WORDS[face];
  if (amount === 2) return `Turn the ${layer} half a turn, either way.`;
  return `Turn the ${layer} ${amount === 1 ? 'clockwise' : 'counter-clockwise'}, as seen ${view}.`;
}
