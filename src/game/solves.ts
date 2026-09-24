import { useEffect } from 'react';
import { create } from 'zustand';
import { formatMoves } from '../cube/moves';
import { playPersonalBest, playSolve, vibrate } from './feedback';
import { celebrate } from './personalBest';
import { newRecords } from './stats';
import { useCubeStore } from './store';

export interface Solve {
  id: string;
  timeMs: number;
  moves: number;
  /** The scramble in standard notation. */
  scramble: string;
  /** When it was solved, in ms since epoch. */
  date: number;
  /** The player's moves in standard notation, for replaying. Missing on older records. */
  solution?: string;
  /** True if a hint was used. Assisted solves are kept but left out of the stats. */
  assisted?: boolean;
}

const STORAGE_KEY = 'cube-puzzle:solves:v1';
/** Keeps storage small; well beyond what the averages need. */
export const MAX_SOLVES = 500;

const isSolve = (v: unknown): v is Solve => {
  const s = v as Solve;
  return (
    typeof s === 'object' &&
    s !== null &&
    typeof s.id === 'string' &&
    Number.isFinite(s.timeMs) &&
    Number.isFinite(s.moves) &&
    typeof s.scramble === 'string' &&
    Number.isFinite(s.date) &&
    (s.solution === undefined || typeof s.solution === 'string') &&
    (s.assisted === undefined || typeof s.assisted === 'boolean')
  );
};

/** Reads saved solves, ignoring anything missing, blocked or malformed. */
export function loadSolves(): Solve[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isSolve).slice(-MAX_SOLVES) : [];
  } catch {
    return [];
  }
}

function saveSolves(solves: Solve[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(solves));
  } catch {
    // Storage can be full or blocked (e.g. a private window); history then lasts for the visit.
  }
}

interface SolveHistory {
  /** Oldest first. */
  solves: Solve[];
  add: (solve: Omit<Solve, 'id'>) => void;
  clear: () => void;
}

let nextId = 0;

export const useSolveHistory = create<SolveHistory>((set) => ({
  solves: loadSolves(),
  add: (solve) =>
    set((s) => {
      const solves = [...s.solves, { ...solve, id: `${solve.date}-${nextId++}` }].slice(-MAX_SOLVES);
      saveSolves(solves);
      return { solves };
    }),
  clear: () =>
    set(() => {
      saveSolves([]);
      return { solves: [] };
    }),
}));

/**
 * Records every solve the game reports, and marks the moment: a chime, or a celebration when
 * an unassisted solve sets a personal best. Mount once, near the app root.
 */
export function useRecordSolves() {
  useEffect(
    () =>
      useCubeStore.subscribe((state, previous) => {
        const solve = state.lastSolve;
        if (!solve || solve === previous.lastSolve) return;
        const history = useSolveHistory.getState();
        const earlier = history.solves.filter((s) => !s.assisted).map((s) => s.timeMs);
        const records = solve.assisted ? [] : newRecords(earlier, solve.timeMs);
        history.add({
          timeMs: solve.timeMs,
          moves: solve.moves,
          scramble: formatMoves(solve.scramble),
          solution: formatMoves(solve.solution),
          assisted: solve.assisted,
          date: Date.now(),
        });
        if (records.length > 0) {
          celebrate(records);
          playPersonalBest();
          vibrate([30, 60, 30, 60, 80]);
        } else {
          playSolve();
          vibrate([20, 40, 20]);
        }
      }),
    [],
  );
}
