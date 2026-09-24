import Cube from 'cubejs';
import { findSolution } from './search';

/**
 * Runs Kociemba's two-phase solver off the main thread. Building its lookup tables takes a
 * couple of seconds (longer on phones), which would otherwise freeze the page.
 */
export interface SolveRequest {
  id: number;
  facelets: string;
}

export type SolverMessage =
  | { type: 'ready' }
  | { type: 'solution'; id: number; moves: string }
  | { type: 'error'; id: number; message: string };

const post = (message: SolverMessage) => self.postMessage(message);

// Requests that arrive while the tables are being built simply wait in the event queue.
self.onmessage = (event: MessageEvent<SolveRequest>) => {
  const { id, facelets } = event.data;
  try {
    post({ type: 'solution', id, moves: findSolution(Cube.fromString(facelets)) });
  } catch (error) {
    post({ type: 'error', id, message: String(error) });
  }
};

Cube.initSolver();
post({ type: 'ready' });
