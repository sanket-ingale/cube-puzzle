import { describe, expect, it } from 'vitest';
import { parseMoves } from '../cube/moves';
import { advancePlan, describeMove } from './guide';

describe('advancePlan', () => {
  const plan = parseMoves("R U2 F'");

  it('moves on when the expected move is made', () => {
    expect(advancePlan(plan, { face: 'R', amount: 1 })).toEqual(parseMoves("U2 F'"));
  });

  it('counts one quarter of a half turn as progress, in either direction', () => {
    const afterR = parseMoves("U2 F'");
    expect(advancePlan(afterR, { face: 'U', amount: 1 })).toEqual(parseMoves("U F'"));
    expect(advancePlan(afterR, { face: 'U', amount: -1 })).toEqual(parseMoves("U' F'"));
  });

  it('treats anything else as a detour', () => {
    expect(advancePlan(plan, { face: 'R', amount: -1 })).toBeNull();
    expect(advancePlan(plan, { face: 'L', amount: 1 })).toBeNull();
    expect(advancePlan([], { face: 'R', amount: 1 })).toBeNull();
  });
});

describe('describeMove', () => {
  it('says which layer, which way, and where to look from', () => {
    expect(describeMove({ face: 'R', amount: 1 })).toBe('Turn the right layer clockwise, as seen from the right.');
    expect(describeMove({ face: 'U', amount: -1 })).toBe('Turn the top layer counter-clockwise, as seen from above.');
    expect(describeMove({ face: 'F', amount: 2 })).toBe('Turn the front layer half a turn, either way.');
  });
});
