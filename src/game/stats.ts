/** Solve statistics, following the World Cube Association's conventions. */

export function best(times: readonly number[]): number | null {
  return times.length ? Math.min(...times) : null;
}

export function mean(times: readonly number[]): number | null {
  return times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
}

/**
 * Average of the most recent `n` times (oldest first in `times`). As in competitions, the
 * single best and single worst are dropped and the rest are averaged. Needs at least `n`.
 */
export function averageOf(times: readonly number[], n: number): number | null {
  if (n < 3 || times.length < n) return null;
  const sorted = times.slice(-n).sort((a, b) => a - b);
  return mean(sorted.slice(1, -1));
}

export type RecordKind = 'single' | 'ao5' | 'ao12';

export interface NewRecord {
  kind: RecordKind;
  value: number;
  previous: number;
}

/**
 * The personal bests a new time sets, given the earlier times (oldest first). A record needs
 * something to beat, so a first solve or a first-ever average isn't one.
 */
export function newRecords(earlier: readonly number[], time: number): NewRecord[] {
  const after = [...earlier, time];
  const records: NewRecord[] = [];

  const previousBest = best(earlier);
  if (previousBest !== null && time < previousBest) {
    records.push({ kind: 'single', value: time, previous: previousBest });
  }

  for (const [kind, n] of [['ao5', 5], ['ao12', 12]] as const) {
    const now = averageOf(after, n);
    // The best average so far: the lowest over every window of n in the earlier times.
    let previous: number | null = null;
    for (let end = n; end <= earlier.length; end++) {
      const a = averageOf(earlier.slice(0, end), n);
      if (a !== null && (previous === null || a < previous)) previous = a;
    }
    if (now !== null && previous !== null && now < previous) records.push({ kind, value: now, previous });
  }
  return records;
}

/**
 * Formats milliseconds as competition times: `9.87`, `12.34`, `1:02.34`. Hundredths are
 * truncated rather than rounded, which is how official timers display them.
 */
export function formatTime(ms: number | null): string {
  if (ms === null) return '–';
  const hundredths = Math.floor(ms / 10);
  const minutes = Math.floor(hundredths / 6000);
  const seconds = Math.floor((hundredths % 6000) / 100);
  const cs = String(hundredths % 100).padStart(2, '0');
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}.${cs}` : `${seconds}.${cs}`;
}
