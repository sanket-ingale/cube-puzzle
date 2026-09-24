import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Cube from 'cubejs';

vi.mock('./client', async () => {
  const { findSolution } = await import('./search');
  const { parseMoves } = await import('../cube/moves');
  const { SOLVED_INPUT } = await import('./facelets');
  return {
    solve: async (facelets: string) =>
      facelets === SOLVED_INPUT ? [] : parseMoves(findSolution(Cube.fromString(facelets))),
    prepareSolver: () => undefined,
    useSolverStatus: () => 'ready',
  };
});

const { useCubeStore } = await import('../game/store');
const { isSolved } = await import('../cube/model');
const { startGuide, stopGuide, subscribeGuide, useGuide } = await import('./guide');

const get = () => useCubeStore.getState();
function playAll() {
  for (let guard = 0; get().active && guard < 1000; guard++) get().completeActive();
}
const flush = () => new Promise((r) => setTimeout(r, 0));

async function waitForPlan() {
  for (let i = 0; i < 200 && useGuide.getState().status === 'planning'; i++) {
    playAll();
    await flush();
  }
}

beforeAll(() => {
  Cube.initSolver();
  subscribeGuide();
}, 30_000);

beforeEach(() => {
  stopGuide();
  playAll();
  get().reset();
  playAll();
});

describe('guided solve', () => {
  it('reaches a solved cube by following every step, one at a time', async () => {
    startGuide();
    await waitForPlan();
    for (let i = 0; i < 60 && useGuide.getState().status === 'ready'; i++) {
      get().enqueue([useGuide.getState().plan[0]]);
      playAll();
      await flush();
    }
    expect(useGuide.getState().status).toBe('done');
    expect(isSolved(get().cubies)).toBe(true);
  });

  it('still reaches solved when moves are made faster than they animate', async () => {
    startGuide();
    await waitForPlan();
    // Queue every remaining step without letting any animation finish.
    for (let i = 0; i < 60 && useGuide.getState().status === 'ready'; i++) {
      get().enqueue([useGuide.getState().plan[0]]);
    }
    playAll();
    await flush();
    expect(useGuide.getState().status).toBe('done');
    expect(isSolved(get().cubies)).toBe(true);
  });

  it('reroutes after a wrong move and still finishes', async () => {
    startGuide();
    await waitForPlan();
    const next = useGuide.getState().plan[0];
    get().enqueue([{ face: next.face === 'L' ? 'R' : 'L', amount: 1 }]);
    playAll();
    await waitForPlan();
    expect(useGuide.getState().rerouted).toBe(true);
    for (let i = 0; i < 60 && useGuide.getState().status === 'ready'; i++) {
      get().enqueue([useGuide.getState().plan[0]]);
      playAll();
      await flush();
    }
    expect(isSolved(get().cubies)).toBe(true);
  });
});

describe('guided solve with half turns made as two quarters', () => {
  it('reaches solved when every half turn is done as two quarter turns', async () => {
    startGuide();
    await waitForPlan();
    for (let i = 0; i < 80 && useGuide.getState().status === 'ready'; i++) {
      const step = useGuide.getState().plan[0];
      get().enqueue([step.amount === 2 ? { face: step.face, amount: 1 } : step]);
      playAll();
      await flush();
    }
    expect(useGuide.getState().status).toBe('done');
    expect(isSolved(get().cubies)).toBe(true);
  });
});
