import { create } from 'zustand';
import { parseMoves, type Move } from '../cube/moves';
import type { SolveRequest, SolverMessage } from './solver.worker';
import SolverWorker from './solver.worker?worker&inline';
import { SOLVED_INPUT } from './facelets';

export type SolverStatus = 'idle' | 'loading' | 'ready' | 'error';

export const useSolverStatus = create<{ status: SolverStatus }>(() => ({ status: 'idle' }));

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (moves: Move[]) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  useSolverStatus.setState({ status: 'loading' });
  worker = new SolverWorker();
  worker.onmessage = (event: MessageEvent<SolverMessage>) => {
    const message = event.data;
    if (message.type === 'ready') {
      useSolverStatus.setState({ status: 'ready' });
      return;
    }
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.type === 'solution') request?.resolve(parseMoves(message.moves));
    else request?.reject(new Error(message.message));
  };
  worker.onerror = () => {
    useSolverStatus.setState({ status: 'error' });
    for (const { reject } of pending.values()) reject(new Error('The solver stopped working.'));
    pending.clear();
  };
  return worker;
}

/** Starts building the solver's tables in the background, ahead of the first request. */
export function prepareSolver() {
  getWorker();
}

/** A shortest-ish solution (at most 22 moves) for a cube given as a Kociemba string. */
export function solve(facelets: string): Promise<Move[]> {
  // The solver returns a long identity sequence for a solved cube, so answer that directly.
  if (facelets === SOLVED_INPUT) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, facelets } satisfies SolveRequest);
  });
}
