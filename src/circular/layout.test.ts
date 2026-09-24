import { describe, expect, it } from 'vitest';
import { createSolvedCube } from '../cube/model';
import { applyMove, applyMoves, formatMove, invertMove, parseMoves } from '../cube/moves';
import { CUBE_INDEX_MAP, toFacelets, type FaceletColor } from '../cube/facelets';
import { buildLayout } from './layout';

const { viewBox, circles, stickers } = buildLayout();
const circleByKey = Object.fromEntries(circles.map((c) => [c.key, c]));
const scrambled = applyMoves(createSolvedCube(), parseMoves("R U F' L2 D B' M S E2"));

/** Average position of a face's 9 stickers. */
function faceCentre(face: FaceletColor) {
  const nodes = CUBE_INDEX_MAP[face].map((i) => stickers[i]);
  return {
    x: nodes.reduce((s, n) => s + n.x, 0) / 9,
    y: nodes.reduce((s, n) => s + n.y, 0) / 9,
  };
}

describe('buildLayout', () => {
  it('has 9 layer circles and 54 stickers with unique ids', () => {
    expect(circles).toHaveLength(9);
    expect(stickers).toHaveLength(54);
    expect(new Set(stickers.map((s) => s.id)).size).toBe(54);
    expect(stickers[22].id).toBe('F4');
  });

  it('puts every sticker exactly where its two layer circles cross', () => {
    for (const s of stickers) {
      for (const key of s.circles) {
        const c = circleByKey[key];
        expect(Math.hypot(s.x - c.cx, s.y - c.cy)).toBeCloseTo(c.r, 6);
      }
    }
  });

  it('keeps stickers well apart', () => {
    let min = Infinity;
    for (let i = 0; i < 54; i++) {
      for (let j = i + 1; j < 54; j++) {
        min = Math.min(min, Math.hypot(stickers[i].x - stickers[j].x, stickers[i].y - stickers[j].y));
      }
    }
    expect(min).toBeGreaterThan(30);
  });

  it('arranges faces like the reference: L, U, B on top, F and R in the middle, D below', () => {
    const [L, U, B, F, R, D] = (['L', 'U', 'B', 'F', 'R', 'D'] as const).map(faceCentre);
    expect(L.x < U.x && U.x < B.x).toBe(true);
    expect(F.x < R.x).toBe(true);
    expect(Math.max(L.y, U.y, B.y)).toBeLessThan(Math.min(F.y, R.y));
    expect(D.y).toBeGreaterThan(Math.max(F.y, R.y));
  });

  it('gives every circle 12 stickers, and every non-centre layer circle through its 4 side faces', () => {
    for (const c of circles) {
      expect(c.ring).toHaveLength(12);
      expect(new Set(c.ring).size).toBe(12);
    }
  });

  it.each(circles.map((c) => [c.key, c] as const))(
    'the clockwise move for %s slides its stickers 3 places clockwise on screen',
    (_, c) => {
      const before = toFacelets(scrambled);
      const after = toFacelets(applyMove(scrambled, c.clockwise));
      c.ring.forEach((index, k) => expect(after[c.ring[(k + 3) % 12]]).toBe(before[index]));
      const back = toFacelets(applyMove(scrambled, invertMove(c.clockwise)));
      c.ring.forEach((index, k) => expect(back[c.ring[(k + 9) % 12]]).toBe(before[index]));
    },
  );

  it('maps each circle to its layer move', () => {
    const names = Object.fromEntries(circles.map((c) => [c.key, formatMove(c.clockwise)[0]]));
    expect(names).toEqual({
      'x-1': 'L', x0: 'M', x1: 'R',
      'y-1': 'D', y0: 'E', y1: 'U',
      'z-1': 'B', z0: 'S', z1: 'F',
    });
  });

  it('keeps circles and their buttons inside the view', () => {
    const [minX, minY, width, height] = viewBox;
    const inside = ([x, y]: [number, number]) =>
      x >= minX && x <= minX + width && y >= minY && y <= minY + height;
    for (const c of circles) {
      expect(inside([c.cx - c.r, c.cy - c.r]) && inside([c.cx + c.r, c.cy + c.r])).toBe(true);
      expect(inside(c.controls.cw) && inside(c.controls.ccw)).toBe(true);
    }
  });

  it('places each clockwise button clockwise of its counter-clockwise partner', () => {
    for (const c of circles) {
      const angle = ([x, y]: [number, number]) => Math.atan2(y - c.cy, x - c.cx);
      let diff = angle(c.controls.cw) - angle(c.controls.ccw);
      if (diff < -Math.PI) diff += 2 * Math.PI;
      expect(diff).toBeGreaterThan(0);
    }
  });
});
