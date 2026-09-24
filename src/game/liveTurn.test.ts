import { beforeEach, describe, expect, it } from 'vitest';
import { beginLiveTurn, endLiveTurn, updateLiveTurn } from './liveTurn';
import { useCubeStore } from './store';
import { liveDrag } from './turnProgress';

const q = Math.PI / 2;
const get = () => useCubeStore.getState();
function settle() {
  for (let guard = 0; get().active && guard < 100; guard++) get().completeActive();
  // What the 3D view does once a spring-back reaches rest.
  if (liveDrag.springBack) {
    liveDrag.springBack = false;
    get().releaseGrab(null);
  }
}

beforeEach(() => {
  settle();
  get().reset();
  settle();
});

describe('live turns', () => {
  it('commits the nearest quarter turn, starting from the angle it was let go at', () => {
    expect(beginLiveTurn('x', 1, 0)).toBe(true);
    updateLiveTurn(-0.3 * q, 100);
    updateLiveTurn(-0.8 * q, 400);
    endLiveTurn(900);
    expect(get().active).toMatchObject({ move: { face: 'R', amount: 1 }, from: -0.8 * q, to: -q });
  });

  it('springs back when let go early and slowly', () => {
    beginLiveTurn('y', 1, 0);
    updateLiveTurn(0.3 * q, 500);
    endLiveTurn(1000);
    expect(liveDrag.springBack).toBe(true);
    expect(get().active).toBeNull();
    settle();
    expect(get().grab).toBeNull();
    expect(get().history).toEqual([]);
  });

  it('completes the turn on a quick flick', () => {
    beginLiveTurn('y', 1, 0);
    updateLiveTurn(0.1 * q, 16);
    updateLiveTurn(0.3 * q, 32);
    endLiveTurn(40);
    expect(get().active?.move).toEqual({ face: 'U', amount: -1 });
  });

  it('does not count a pause before lifting as a flick', () => {
    beginLiveTurn('y', 1, 0);
    updateLiveTurn(0.1 * q, 16);
    updateLiveTurn(0.3 * q, 32);
    endLiveTurn(500);
    expect(get().active).toBeNull();
  });

  it('springs back on a cancelled touch', () => {
    beginLiveTurn('z', 1, 0);
    updateLiveTurn(-0.9 * q, 300);
    endLiveTurn(310, true);
    expect(get().active).toBeNull();
    expect(liveDrag.springBack).toBe(true);
  });

  it('cannot grab while another move is playing', () => {
    get().enqueue([{ face: 'R', amount: 1 }]);
    expect(beginLiveTurn('y', 1, 0)).toBe(false);
  });
});
