import type Cube from 'cubejs';

/**
 * Depths tried one by one before falling back to the full two-phase search. Deeper limits get
 * expensive on symmetric positions (the checkerboard takes seconds at 7–8), so this stays at 6.
 */
const SHORT_SEARCH_DEPTH = 6;

/**
 * Two-phase search is fast but not optimal: one move from solved it can answer with eight.
 * Trying small depth limits first finds the short answers exactly, which matters for hints
 * near the end of a solve (anything within 6 moves); beyond that, the full search returns at most 22 moves. (The
 * library throws when no solution fits within the limit.)
 */
export function findSolution(cube: Cube): string {
  for (let depth = 1; depth <= SHORT_SEARCH_DEPTH; depth++) {
    try {
      return cube.solve(depth);
    } catch {
      // Nothing within this depth; try one deeper.
    }
  }
  return cube.solve();
}
