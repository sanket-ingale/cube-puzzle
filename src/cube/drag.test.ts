import { describe, expect, it } from 'vitest';
import type { Vec3 } from './model';
import {
  faceHitFromPoint,
  faceTangents,
  pickDragDirection,
  settleQuarterTurns,
  snapQuarterTurns,
  turnFromDrag,
} from './drag';
import { formatMove, moveToTurn, MOVE_FACES, turnToMove } from './moves';

/** Grab the sticker at `point` and drag it along `direction`; returns the move in notation. */
function dragMove(point: Vec3, direction: Vec3): string {
  const hit = faceHitFromPoint(point)!;
  return formatMove(turnToMove(turnFromDrag(hit, direction)));
}

describe('faceHitFromPoint', () => {
  it('finds the face and cubie for a point on the surface', () => {
    expect(faceHitFromPoint([0.9, -1.1, 1.49])).toEqual({ normal: [0, 0, 1], position: [1, -1, 1] });
    expect(faceHitFromPoint([0.1, 1.5, -0.2])).toEqual({ normal: [0, 1, 0], position: [0, 1, 0] });
    expect(faceHitFromPoint([-1.48, 0.4, 0.6])).toEqual({ normal: [-1, 0, 0], position: [-1, 0, 1] });
  });

  it('ignores points inside the cube', () => {
    expect(faceHitFromPoint([0.5, 0.48, 0.2])).toBeNull();
  });
});

describe('drag to move', () => {
  it.each<[string, Vec3, Vec3, string]>([
    ['front face, right column, dragged up', [1, 0, 1.5], [0, 1, 0], 'R'],
    ['front face, right column, dragged down', [1, 0, 1.5], [0, -1, 0], "R'"],
    ['front face, left column, dragged down', [-1, 0, 1.5], [0, -1, 0], 'L'],
    ['front face, top row, dragged left', [0, 1, 1.5], [-1, 0, 0], 'U'],
    ['front face, bottom row, dragged right', [0, -1, 1.5], [1, 0, 0], 'D'],
    ['top face, front row, dragged right', [0, 1.5, 1], [1, 0, 0], 'F'],
    ['top face, back row, dragged left', [0, 1.5, -1], [-1, 0, 0], 'B'],
    ['right face, front column, dragged up', [1.5, 0, 1], [0, 1, 0], "F'"],
    ['front face, middle column, dragged down', [0, 0, 1.5], [0, -1, 0], 'M'],
    ['front face, middle row, dragged right', [0, 0, 1.5], [1, 0, 0], 'E'],
    ['top face, middle row, dragged right', [0, 1.5, 0], [1, 0, 0], 'S'],
  ])('%s is %s', (_, point, direction, expected) => {
    expect(dragMove(point, direction)).toBe(expected);
  });
});

describe('snapQuarterTurns', () => {
  const q = Math.PI / 2;
  it.each([
    [0.3 * q, 0],
    [-0.45 * q, 0],
    [0.55 * q, 1],
    [-0.8 * q, -1],
    [1.4 * q, 1],
    [1.6 * q, 2],
    [3.2 * q, 3],
  ])('an angle of %f settles on %i quarter turns', (angle, quarters) => {
    expect(snapQuarterTurns(angle)).toBe(quarters);
  });
});

describe('settleQuarterTurns', () => {
  const q = Math.PI / 2;
  it('springs back from a slow, short drag', () => {
    expect(settleQuarterTurns(0.3 * q, 1)).toBe(0);
  });
  it('completes the turn on a quick flick', () => {
    expect(settleQuarterTurns(0.3 * q, 8)).toBe(1);
    expect(settleQuarterTurns(-0.3 * q, -8)).toBe(-1);
  });
  it('ignores a flick against the drag, or one that barely moved', () => {
    expect(settleQuarterTurns(0.3 * q, -8)).toBe(0);
    expect(settleQuarterTurns(0.05 * q, 8)).toBe(0);
  });
  it('snaps normally past halfway', () => {
    expect(settleQuarterTurns(1.7 * q, 0)).toBe(2);
  });
});

describe('turnToMove', () => {
  it('reduces multiple quarter turns to one move', () => {
    expect(turnToMove({ axis: 'x', layer: 1, quarterTurns: -2 })).toEqual({ face: 'R', amount: 2 });
    expect(turnToMove({ axis: 'x', layer: 1, quarterTurns: 3 })).toEqual({ face: 'R', amount: 1 });
    expect(turnToMove({ axis: 'x', layer: 1, quarterTurns: -3 })).toEqual({ face: 'R', amount: -1 });
  });

  it.each(MOVE_FACES)('round-trips %s and its inverse', (face) => {
    for (const amount of [1, -1] as const) {
      expect(turnToMove(moveToTurn({ face, amount }))).toEqual({ face, amount });
    }
  });
});

describe('pickDragDirection', () => {
  const tangents = faceTangents([0, 0, 1]); // +x, +y on the front face

  it('follows the tangent that best matches the drag', () => {
    // Screen: +x points right, +y points up (negative screen y).
    const screen: [[number, number], [number, number]] = [
      [40, 5],
      [3, -40],
    ];
    expect(pickDragDirection(tangents, screen, [30, 2])).toEqual([1, 0, 0]);
    expect(pickDragDirection(tangents, screen, [-30, 6])).toEqual([-1, 0, 0]);
    expect(pickDragDirection(tangents, screen, [2, -25])).toEqual([0, 1, 0]);
    expect(pickDragDirection(tangents, screen, [0, 25])).toEqual([0, -1, 0]);
  });

  it('skips a tangent that points straight at the camera', () => {
    expect(pickDragDirection(tangents, [[0, 0], [0, -40]], [5, -30])).toEqual([0, 1, 0]);
  });
});
