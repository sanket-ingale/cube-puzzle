import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSolvedCube, isSolved } from '../cube/model';
import { applyMoves, invertMove, parseMoves } from '../cube/moves';
import { useCubeStore } from './store';

const store = useCubeStore;
const get = () => store.getState();

/** Stands in for the animator: finishes moves until nothing is left to play. */
function playAll() {
  for (let guard = 0; get().active && guard < 1000; guard++) get().completeActive();
}

function scrambleAndSettle() {
  get().scrambleCube();
  playAll();
}

beforeEach(() => {
  playAll();
  get().reset();
  playAll();
});

describe('animated reset', () => {
  it('rewinds to solved and clears the history', () => {
    get().enqueue(parseMoves("R U F' L2 D B M' E S2"));
    playAll();
    expect(isSolved(get().cubies)).toBe(false);

    get().reset();
    expect(get().mode).toBe('resetting');
    expect(get().history).toEqual([]);
    playAll();

    expect(isSolved(get().cubies)).toBe(true);
    expect(get().mode).toBe('play');
  });

  it('plays the inverse moves newest first', () => {
    get().enqueue(parseMoves('R U2 F'));
    playAll();
    get().reset();
    expect([get().active!.move, ...get().queue]).toEqual(parseMoves("F' U2 R'"));
  });

  it('cancels queued moves instead of playing them and then undoing them', () => {
    get().enqueue(parseMoves("R U R' U'"));
    get().completeActive(); // R done, U animating, R' U' queued
    get().reset();
    // U is still animating; its inverse and R's inverse are all that's left.
    expect(get().queue).toEqual(parseMoves("U' R'"));
    playAll();
    expect(isSolved(get().cubies)).toBe(true);
  });

  it('ignores new moves while resetting', () => {
    get().enqueue(parseMoves('R U'));
    playAll();
    get().reset();
    get().enqueue(parseMoves('F'));
    playAll();
    expect(isSolved(get().cubies)).toBe(true);
  });

  it('skips the rewind when the moves already cancel out', () => {
    get().enqueue(parseMoves('R R R R'));
    playAll();
    get().reset();
    expect(get().active).toBeNull();
    expect(get().mode).toBe('play');
  });

  it('can reset mid-scramble', () => {
    get().scrambleCube();
    get().completeActive();
    get().completeActive();
    get().reset();
    playAll();
    expect(isSolved(get().cubies)).toBe(true);
    expect(get().scramble).toEqual([]);
  });
});

describe('scramble', () => {
  it('applies the scramble and locks input until it finishes', () => {
    get().scrambleCube();
    expect(get().mode).toBe('scrambling');
    get().enqueue(parseMoves('R'));
    playAll();

    const s = get();
    expect(s.mode).toBe('play');
    expect(s.history).toEqual(s.scramble);
    expect(s.userStart).toBe(s.scramble.length);
    expect(s.cubies).toEqual(applyMoves(createSolvedCube(), s.scramble));
  });
});

describe('undo and redo', () => {
  it('undoes the player’s moves but not the scramble', () => {
    scrambleAndSettle();
    const scrambled = get().cubies;
    get().enqueue(parseMoves('R U'));
    playAll();

    get().undo();
    get().undo();
    get().undo(); // nothing left to undo: must not touch the scramble
    playAll();

    expect(get().cubies).toEqual(scrambled);
    expect(get().history.length).toBe(get().userStart);
  });

  it('undoes a different move on each press, even mid-animation', () => {
    get().enqueue(parseMoves('R U F'));
    get().undo();
    get().undo();
    get().undo();
    playAll();
    expect(isSolved(get().cubies)).toBe(true);
    expect(get().history).toEqual([]);
  });

  it('redoes undone moves in order', () => {
    get().enqueue(parseMoves('R U'));
    playAll();
    const after = get().cubies;
    get().undo();
    get().undo();
    get().redo();
    get().redo();
    playAll();
    expect(get().cubies).toEqual(after);
    expect(get().redoStack).toEqual([]);
  });

  it('clears the redo stack when a new move is made', () => {
    get().enqueue(parseMoves('R'));
    get().undo();
    get().enqueue(parseMoves('U'));
    expect(get().redoStack).toEqual([]);
  });
});

describe('solve detection', () => {
  it('records a solve with the player’s move count', () => {
    scrambleAndSettle();
    const solution = [...get().scramble].reverse().map(invertMove);
    get().enqueue(solution);
    playAll();
    expect(get().lastSolve).toMatchObject({ moves: solution.length, scramble: get().scramble });
  });

  it('does not count moves that only pass through solved', () => {
    scrambleAndSettle();
    const solution = [...get().scramble].reverse().map(invertMove);
    // Solved after the last solution move, then turned away again before settling.
    get().enqueue([...solution, ...parseMoves('R')]);
    playAll();
    expect(get().lastSolve).toBeNull();
  });

  it('does not count a solved cube without a scramble', () => {
    get().enqueue(parseMoves("R R'"));
    playAll();
    expect(get().lastSolve).toBeNull();
  });

  it('clears the solve on the next move', () => {
    scrambleAndSettle();
    get().enqueue([...get().scramble].reverse().map(invertMove));
    playAll();
    get().enqueue(parseMoves('R'));
    expect(get().lastSolve).toBeNull();
  });
});

describe('timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => vi.useRealTimers());

  const solution = () => [...get().scramble].reverse().map(invertMove);

  it('starts on the first move after a scramble, not during it', () => {
    get().scrambleCube();
    expect(get().timerStart).toBeNull();
    playAll();
    expect(get().timerStart).toBeNull();

    vi.setSystemTime(1_005_000);
    get().enqueue(parseMoves('R'));
    expect(get().timerStart).toBe(1_005_000);

    vi.setSystemTime(1_006_000);
    get().enqueue(parseMoves('U'));
    expect(get().timerStart).toBe(1_005_000);
  });

  it('does not run without a scramble', () => {
    get().enqueue(parseMoves('R U'));
    expect(get().timerStart).toBeNull();
  });

  it('stops on the solve and records the time', () => {
    scrambleAndSettle();
    vi.setSystemTime(1_010_000);
    get().enqueue(solution());
    vi.setSystemTime(1_022_340);
    playAll();

    expect(get().lastSolve).toMatchObject({ timeMs: 12_340 });
    expect(get().timerStart).toBeNull();
    expect(get().attemptDone).toBe(true);
  });

  it('records each scramble only once, even if it is solved again after undoing', () => {
    scrambleAndSettle();
    get().enqueue(solution());
    playAll();
    const first = get().lastSolve;

    get().undo();
    playAll();
    get().redo();
    playAll();

    expect(first).not.toBeNull();
    expect(get().lastSolve).toBeNull();
    expect(get().timerStart).toBeNull();
  });

  it('abandons the attempt on reset and on a new scramble', () => {
    scrambleAndSettle();
    get().enqueue(parseMoves('R'));
    expect(get().timerStart).not.toBeNull();
    get().scrambleCube();
    expect(get().timerStart).toBeNull();
    playAll();

    get().enqueue(parseMoves('R'));
    get().reset();
    expect(get().timerStart).toBeNull();
    expect(get().attemptDone).toBe(false);
  });
});

describe('hints and auto-solve', () => {
  const solution = () => [...get().scramble].reverse().map(invertMove);

  it('marks a hinted attempt as assisted in the recorded solve', () => {
    scrambleAndSettle();
    get().markAssisted();
    get().enqueue(solution());
    playAll();
    expect(get().lastSolve).toMatchObject({ assisted: true });
  });

  it('does not mark anything assisted without a scramble', () => {
    get().markAssisted();
    expect(get().assisted).toBe(false);
  });

  it('auto-solve locks input, finishes the cube and records nothing', () => {
    scrambleAndSettle();
    get().enqueue(parseMoves('R'));
    playAll();
    get().autoSolve([...parseMoves("R'"), ...solution()]);
    expect(get().mode).toBe('solving');
    get().enqueue(parseMoves('U')); // ignored while solving
    playAll();

    expect(isSolved(get().cubies)).toBe(true);
    expect(get().mode).toBe('play');
    expect(get().lastSolve).toBeNull();
    expect(get().attemptDone).toBe(true);
  });
});

describe('replay', () => {
  it('jumps to the scramble and plays the saved moves back', () => {
    const scramble = parseMoves("R U F'");
    const moves = parseMoves("F U' R'");
    get().enqueue(parseMoves('L D')); // whatever was on the cube before
    playAll();

    get().replay(scramble, moves);
    expect(get().mode).toBe('replaying');
    expect(get().cubies).toEqual(applyMoves(createSolvedCube(), scramble));
    get().enqueue(parseMoves('B')); // ignored while replaying
    playAll();

    expect(isSolved(get().cubies)).toBe(true);
    expect(get().mode).toBe('play');
    expect(get().lastSolve).toBeNull();
  });

  it('can be stopped with reset, which rewinds to solved', () => {
    get().replay(parseMoves("R U F'"), parseMoves("F U' R'"));
    get().completeActive();
    get().reset();
    playAll();
    expect(isSolved(get().cubies)).toBe(true);
    expect(get().history).toEqual([]);
  });
});

describe('inspection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);
    get().setInspection(true);
  });
  afterEach(() => {
    get().setInspection(false);
    vi.useRealTimers();
  });

  it('starts inspection when the scramble finishes, and the clock on the first move', () => {
    get().scrambleCube();
    expect(get().inspectionStart).toBeNull();
    playAll();
    expect(get().inspectionStart).toBe(2_000_000);

    vi.setSystemTime(2_004_000);
    get().enqueue(parseMoves('R'));
    expect(get().timerStart).toBe(2_004_000);
    expect(get().inspectionStart).toBeNull();
  });

  it('starts the clock on its own when the 15 seconds run out', () => {
    scrambleAndSettle();
    vi.setSystemTime(2_000_000 + 15_000 + 3_000);
    get().enqueue(parseMoves('R'));
    // Counted from the end of inspection, not from the late first move.
    expect(get().timerStart).toBe(2_015_000);
  });

  it('includes overrun time in the recorded solve', () => {
    scrambleAndSettle();
    vi.setSystemTime(2_020_000);
    get().enqueue([...get().scramble].reverse().map(invertMove));
    vi.setSystemTime(2_030_000);
    playAll();
    expect(get().lastSolve?.timeMs).toBe(15_000);
  });
});

describe('turning a layer by hand', () => {
  it('holds other moves while a layer is grabbed, then commits the released move', () => {
    expect(get().startGrab({ axis: 'x', layer: 1 })).toBe(true);
    get().enqueue(parseMoves('U')); // ignored while grabbed
    expect(get().active).toBeNull();

    get().releaseGrab({ move: { face: 'R', amount: 1 }, from: -1.2, to: -Math.PI / 2 });
    expect(get().grab).toBeNull();
    expect(get().active).toMatchObject({ move: { face: 'R', amount: 1 }, from: -1.2 });
    expect(get().history).toEqual(parseMoves('R'));
    playAll();
    expect(get().cubies).toEqual(applyMoves(createSolvedCube(), parseMoves('R')));
  });

  it('springs back without a move when let go early', () => {
    get().startGrab({ axis: 'y', layer: 1 });
    get().releaseGrab(null);
    expect(get().grab).toBeNull();
    expect(get().history).toEqual([]);
  });

  it('refuses a grab while something is moving', () => {
    get().enqueue(parseMoves('R'));
    expect(get().startGrab({ axis: 'y', layer: 1 })).toBe(false);
  });

  it('starts the timer on a released drag, like any first move', () => {
    scrambleAndSettle();
    get().startGrab({ axis: 'x', layer: 1 });
    get().releaseGrab({ move: { face: 'R', amount: 1 }, from: -1.4, to: -Math.PI / 2 });
    expect(get().timerStart).not.toBeNull();
  });
});
