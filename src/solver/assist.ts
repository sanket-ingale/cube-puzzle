import { create } from 'zustand';
import type { Move } from '../cube/moves';
import { useCubeStore } from '../game/store';
import { solve } from './client';
import { solverInput } from './facelets';

interface Assist {
  /** The suggested next move, and the history it was worked out for. */
  hint: { move: Move; history: readonly Move[] } | null;
  pending: 'hint' | 'solve' | null;
  error: string | null;
}

export const useAssist = create<Assist>(() => ({ hint: null, pending: null, error: null }));

const SOLVER_ERROR = "The solver couldn't start. Try reloading the page.";

/** Asks the solver for the cube as it sits now; null if the cube changed while it worked. */
async function solveCurrent(kind: 'hint' | 'solve'): Promise<Move[] | null> {
  const start = useCubeStore.getState();
  if (start.mode !== 'play' || start.active) return null;
  useAssist.setState({ pending: kind, error: null });
  try {
    const moves = await solve(solverInput(start.cubies));
    // Any move made meanwhile replaces the history array, which makes the answer stale.
    return useCubeStore.getState().history === start.history ? moves : null;
  } catch {
    useAssist.setState({ error: SOLVER_ERROR });
    return null;
  } finally {
    useAssist.setState({ pending: null });
  }
}

export async function requestHint() {
  const moves = await solveCurrent('hint');
  if (!moves?.length) return;
  const game = useCubeStore.getState();
  game.markAssisted();
  useAssist.setState({ hint: { move: moves[0], history: game.history } });
}

export async function requestSolve() {
  const moves = await solveCurrent('solve');
  if (!moves?.length) return;
  useAssist.setState({ hint: null });
  useCubeStore.getState().autoSolve(moves);
}

/** The hint, but only while the cube is still exactly where it was when the hint was given. */
export function useCurrentHint(): Move | null {
  const hint = useAssist((s) => s.hint);
  const history = useCubeStore((s) => s.history);
  const playing = useCubeStore((s) => s.mode === 'play');
  return hint && playing && hint.history === history ? hint.move : null;
}
