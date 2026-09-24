import { afterEach, describe, expect, it, vi } from 'vitest';
import { averageOf, best, formatTime, mean, newRecords } from './stats';

describe('stats', () => {
  it('finds the best single and the mean', () => {
    expect(best([12_000, 9_500, 15_000])).toBe(9_500);
    expect(best([])).toBeNull();
    expect(mean([10_000, 20_000])).toBe(15_000);
  });

  it('averages the latest n, dropping the best and worst', () => {
    // Latest five: 20, 11, 12, 13, 5 (seconds). Drop 5 and 20, average 11, 12, 13.
    const times = [99_000, 20_000, 11_000, 12_000, 13_000, 5_000];
    expect(averageOf(times, 5)).toBe(12_000);
  });

  it('needs at least n solves for an average', () => {
    expect(averageOf([10_000, 11_000, 12_000, 13_000], 5)).toBeNull();
  });
});

describe('newRecords', () => {
  it('needs something to beat', () => {
    expect(newRecords([], 10_000)).toEqual([]);
  });

  it('spots a new best single, with the time it beat', () => {
    expect(newRecords([15_000, 12_000], 11_000)).toEqual([{ kind: 'single', value: 11_000, previous: 12_000 }]);
    expect(newRecords([15_000, 12_000], 13_000)).toEqual([]);
  });

  it('spots a new best average of 5 against every earlier window', () => {
    const earlier = [20_000, 20_000, 20_000, 20_000, 20_000, 10_000, 10_000, 10_000, 10_000];
    // Best earlier Ao5 is the window 20 10 10 10 10 -> 10.0; one more 9.0 gives 10 10 10 10 9 -> 10.0 (not lower).
    expect(newRecords(earlier, 9_000).map((r) => r.kind)).toEqual(['single']);
    // A run that lowers the average does count.
    expect(newRecords([12_000, 12_000, 12_000, 12_000, 12_000], 9_000)).toEqual([
      { kind: 'single', value: 9_000, previous: 12_000 },
    ]);
    // Best and worst are dropped, so a single faster time alone doesn't move the average...
    expect(newRecords([12_000, 12_000, 12_000, 12_000, 12_000, 12_000], 11_000).map((r) => r.kind)).toEqual(['single']);
    // ...but consistently faster times do. Best earlier Ao5 here is 11.33; the new one is 10.67.
    const records = newRecords([12_000, 12_000, 12_000, 12_000, 10_000, 10_000], 10_000);
    expect(records.map((r) => r.kind)).toEqual(['ao5']);
    expect(records[0].previous).toBeCloseTo(11_333.3, 0);
  });
});

describe('formatTime', () => {
  it.each([
    [9_876, '9.87'],
    [12_340, '12.34'],
    [12_349, '12.34'], // truncated, not rounded
    [62_345, '1:02.34'],
    [600_000, '10:00.00'],
    [0, '0.00'],
  ])('%i ms is %s', (ms, text) => {
    expect(formatTime(ms)).toBe(text);
  });

  it('shows a dash for a missing value', () => {
    expect(formatTime(null)).toBe('–');
  });
});

describe('solve history', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  function stubStorage(initial: Record<string, string> = {}) {
    const data = { ...initial };
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
    });
    return data;
  }

  it('saves solves and loads them back', async () => {
    const data = stubStorage();
    const { useSolveHistory } = await import('./solves');
    useSolveHistory.getState().add({ timeMs: 12_340, moves: 40, scramble: "R U R'", date: 1 });

    vi.resetModules();
    stubStorage(data);
    const reloaded = await import('./solves');
    expect(reloaded.useSolveHistory.getState().solves).toMatchObject([{ timeMs: 12_340, moves: 40 }]);
  });

  it('keeps older records without a solution or assisted flag', async () => {
    stubStorage({
      'cube-puzzle:solves:v1': JSON.stringify([{ id: 'old', timeMs: 1, moves: 2, scramble: 'R', date: 3 }]),
    });
    const { loadSolves } = await import('./solves');
    expect(loadSolves()).toHaveLength(1);
  });

  it('ignores malformed saved data', async () => {
    stubStorage({
      'cube-puzzle:solves:v1': JSON.stringify([{ id: 'a', timeMs: 'fast' }, { id: 'b', timeMs: 1, moves: 2, scramble: 'R', date: 3 }]),
    });
    const { loadSolves } = await import('./solves');
    expect(loadSolves().map((s) => s.id)).toEqual(['b']);
  });

  it('works without storage at all', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    const { useSolveHistory } = await import('./solves');
    expect(useSolveHistory.getState().solves).toEqual([]);
    useSolveHistory.getState().add({ timeMs: 1, moves: 1, scramble: 'R', date: 1 });
    expect(useSolveHistory.getState().solves).toHaveLength(1);
  });

  it('caps the history', async () => {
    stubStorage();
    const { useSolveHistory, MAX_SOLVES } = await import('./solves');
    for (let i = 0; i < MAX_SOLVES + 5; i++) {
      useSolveHistory.getState().add({ timeMs: i, moves: 1, scramble: 'R', date: i });
    }
    const { solves } = useSolveHistory.getState();
    expect(solves).toHaveLength(MAX_SOLVES);
    expect(solves[0].timeMs).toBe(5);
  });
});
