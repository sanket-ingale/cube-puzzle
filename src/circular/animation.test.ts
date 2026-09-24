import { describe, expect, it } from 'vitest';
import { turnPermutation } from '../cube/facelets';
import { MOVE_FACES, moveToTurn, type Move } from '../cube/moves';
import { buildTurnPaths, layerPositionsAt, quartersForDrag } from './animation';
import { buildLayout } from './layout';

const layout = buildLayout();
const moves: Move[] = MOVE_FACES.flatMap((face) =>
  ([1, -1, 2] as const).map((amount) => ({ face, amount })),
);
const label = (m: Move) => m.face + (m.amount === 2 ? '2' : m.amount === -1 ? "'" : '');

describe('buildTurnPaths', () => {
  it.each(moves.map((m) => [label(m), m] as const))('%s: every path starts and ends on the right sticker', (_, move) => {
    const perm = turnPermutation(moveToTurn(move));
    const paths = buildTurnPaths(layout, move);
    expect(paths.length).toBe(perm.filter((to, from) => to !== from).length);
    for (const { index, at } of paths) {
      const start = layout.stickers[index];
      const end = layout.stickers[perm[index]];
      expect(at(0)[0]).toBeCloseTo(start.x, 6);
      expect(at(0)[1]).toBeCloseTo(start.y, 6);
      expect(at(1)[0]).toBeCloseTo(end.x, 6);
      expect(at(1)[1]).toBeCloseTo(end.y, 6);
    }
  });

  it.each(layout.circles.map((c) => [c.key, c] as const))(
    'circle %s: ring dots stay on the circle and travel clockwise for its clockwise move',
    (_, circle) => {
      const paths = buildTurnPaths(layout, circle.clockwise).filter((p) => circle.ring.includes(p.index));
      expect(paths).toHaveLength(12);
      for (const { at } of paths) {
        let previous = Math.atan2(at(0)[1] - circle.cy, at(0)[0] - circle.cx);
        for (let t = 0.1; t <= 1.0001; t += 0.1) {
          const [x, y] = at(t);
          expect(Math.hypot(x - circle.cx, y - circle.cy)).toBeCloseTo(circle.r, 6);
          const angle = Math.atan2(y - circle.cy, x - circle.cx);
          // Clockwise on screen means the angle keeps increasing (allowing for wrap-around).
          const delta = angle - previous;
          expect(delta > 0 || delta < -Math.PI).toBe(true);
          previous = angle;
        }
      }
    },
  );

  it.each(['U', 'R', 'F', 'D', 'L', 'B'] as const)(
    'rotates the turned %s face around its centre by about a quarter turn',
    (face) => {
      const first = 'URFDLB'.indexOf(face) * 9;
      const centre = layout.stickers[first + 4];
      const faceDots = buildTurnPaths(layout, { face, amount: 1 }).filter(
        (p) => p.index >= first && p.index < first + 9,
      );
      expect(faceDots).toHaveLength(8);
      for (const { at } of faceDots) {
        const a0 = Math.atan2(at(0)[1] - centre.y, at(0)[0] - centre.x);
        const a1 = Math.atan2(at(1)[1] - centre.y, at(1)[0] - centre.x);
        const swept = Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)));
        expect(swept).toBeGreaterThan(Math.PI / 4);
        expect(swept).toBeLessThan((3 * Math.PI) / 4);
      }
    },
  );
});

describe('layerPositionsAt', () => {
  const q = Math.PI / 2;

  it.each(layout.circles.map((c) => [c.key, c] as const))(
    'circle %s: whole quarter turns land exactly on the model’s sticker places',
    (_, circle) => {
      for (const k of [-2, -1, 0, 1, 2, 3]) {
        const perm = turnPermutation({ axis: circle.axis, layer: circle.layer, quarterTurns: k });
        const at = layerPositionsAt(layout, circle.axis, circle.layer, k * q);
        for (const [index, [x, y]] of at) {
          const target = layout.stickers[perm[index]];
          expect(x).toBeCloseTo(target.x, 6);
          expect(y).toBeCloseTo(target.y, 6);
        }
      }
    },
  );

  it('keeps ring dots on their circle part-way through, and moves smoothly', () => {
    for (const circle of layout.circles) {
      let previous = layerPositionsAt(layout, circle.axis, circle.layer, -1.2 * q);
      for (let a = -1.2; a <= 1.2; a += 0.05) {
        const now = layerPositionsAt(layout, circle.axis, circle.layer, a * q);
        for (const index of circle.ring) {
          const [x, y] = now.get(index)!;
          expect(Math.hypot(x - circle.cx, y - circle.cy)).toBeCloseTo(circle.r, 6);
          const [px, py] = previous.get(index)!;
          // No jumps. (Across a circle's empty far side a quarter covers ~194°, so dots move
          // fastest there: about 31 units per 0.05 of a quarter on the outer circles.)
          expect(Math.hypot(x - px, y - py)).toBeLessThan(40);
        }
        previous = now;
      }
    }
  });

  it('matches the completed-turn animation at every point of a move', () => {
    const move = { face: 'R' as const, amount: 1 as const };
    const paths = buildTurnPaths(layout, move);
    for (const t of [0.25, 0.5, 0.75]) {
      const at = layerPositionsAt(layout, 'x', 1, -t * q); // R is -90° about x
      for (const { index, at: path } of paths) {
        const [x, y] = path(t);
        expect(at.get(index)![0]).toBeCloseTo(x, 6);
        expect(at.get(index)![1]).toBeCloseTo(y, 6);
      }
    }
  });
});

describe('quartersForDrag', () => {
  it.each(layout.circles.map((c) => [c.key, c] as const))(
    'circle %s: puts the grabbed dot exactly where the pointer has moved it',
    (_, circle) => {
      const sign = Math.sign(moveToTurn(circle.clockwise).quarterTurns);
      const angleAbout = ([x, y]: [number, number]) => Math.atan2(y - circle.cy, x - circle.cx);
      for (const index of circle.ring.slice(0, 4)) {
        const home = layout.stickers[index];
        const start = angleAbout([home.x, home.y]);
        for (const delta of [-4, -2.5, -0.7, -0.1, 0.1, 0.9, 2.2, 3.9]) {
          const quarters = quartersForDrag(layout, circle.key, index, delta);
          const at = layerPositionsAt(layout, circle.axis, circle.layer, quarters * sign * (Math.PI / 2));
          const got = angleAbout(at.get(index)!);
          const diff = Math.atan2(Math.sin(got - start - delta), Math.cos(got - start - delta));
          expect(Math.abs(diff)).toBeLessThan(1e-6);
        }
      }
    },
  );
});
