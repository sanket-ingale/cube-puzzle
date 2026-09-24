import { turnPermutation } from '../cube/facelets';
import type { Axis } from '../cube/model';
import { moveToTurn, turnToMove, type Move } from '../cube/moves';
import type { CircularLayout } from './layout';

type Point = [number, number];

export interface StickerPath {
  /** The sticker position (0–53) whose dot travels along this path. */
  index: number;
  /** Absolute SVG position at progress `t` (0 = start, 1 = end). */
  at: (t: number) => Point;
}

const TAU = Math.PI * 2;
/** Normalises an angle difference into (-π, π]. */
const wrap = (a: number) => a - TAU * Math.floor((a + Math.PI) / TAU);

/** An arc around `center` from `from` to `to`, turning in the direction of `sign`. */
function arcPath(center: Point, from: Point, to: Point, sign: number): (t: number) => Point {
  const r0 = Math.hypot(from[0] - center[0], from[1] - center[1]);
  const r1 = Math.hypot(to[0] - center[0], to[1] - center[1]);
  const a0 = Math.atan2(from[1] - center[1], from[0] - center[0]);
  const a1 = Math.atan2(to[1] - center[1], to[0] - center[0]);
  // Go the way the turn goes, even when that's the long way round (e.g. a half turn).
  let delta = wrap(a1 - a0);
  if (Math.sign(delta) !== sign && Math.abs(delta) > 1e-9) delta += sign * TAU;
  return (t) => {
    const a = a0 + delta * t;
    const r = r0 + (r1 - r0) * t;
    return [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)];
  };
}

/**
 * How each dot moves during `move`. Dots on the turning layer's circle slide along that
 * circle; the turned face's own stickers (outer layers only) rotate around the face's centre
 * sticker. Every path ends exactly where the model puts that sticker after the move.
 */
export function buildTurnPaths(layout: CircularLayout, move: Move): StickerPath[] {
  const turn = moveToTurn(move);
  const key = `${turn.axis}${turn.layer}`;
  const circle = layout.circles.find((c) => c.key === key)!;
  const ring = new Set(circle.ring);

  const perm = turnPermutation(turn);
  const pos = (i: number): Point => [layout.stickers[i].x, layout.stickers[i].y];

  // Along the circle, the direction comes from the move itself. (A quarter step can cross the
  // circle's empty far side and cover more than half of it, so "the short way" isn't reliable.)
  const clockwiseSign = Math.sign(moveToTurn(circle.clockwise).quarterTurns);
  const ringSign = Math.sign(turn.quarterTurns) === clockwiseSign ? 1 : -1;
  // On the turned face, a quarter step is always well under half a turn, so the short way works.
  const step = turnPermutation({ ...turn, quarterTurns: Math.sign(turn.quarterTurns) });

  const paths: StickerPath[] = [];
  for (let i = 0; i < 54; i++) {
    if (perm[i] === i) continue;
    if (ring.has(i)) {
      paths.push({ index: i, at: arcPath([circle.cx, circle.cy], pos(i), pos(perm[i]), ringSign) });
      continue;
    }
    const center = pos(Math.floor(i / 9) * 9 + 4); // turned face: rotate around its centre
    const a0 = Math.atan2(pos(i)[1] - center[1], pos(i)[0] - center[0]);
    const aStep = Math.atan2(pos(step[i])[1] - center[1], pos(step[i])[0] - center[0]);
    paths.push({ index: i, at: arcPath(center, pos(i), pos(perm[i]), Math.sign(wrap(aStep - a0))) });
  }
  return paths;
}

/** Arcs for one positive quarter turn of a layer (about its +axis), cached per layer. */
interface QuarterStep {
  perm: number[];
  arcs: Map<number, (t: number) => Point>;
}
const stepCache = new WeakMap<CircularLayout, Map<string, QuarterStep>>();

function quarterStep(layout: CircularLayout, axis: Axis, layer: number): QuarterStep {
  let byLayer = stepCache.get(layout);
  if (!byLayer) stepCache.set(layout, (byLayer = new Map()));
  const key = `${axis}${layer}`;
  let step = byLayer.get(key);
  if (step) return step;
  const turn = { axis, layer: layer as -1 | 0 | 1, quarterTurns: 1 };
  const perm = turnPermutation(turn);
  const arcs = new Map(buildTurnPaths(layout, turnToMove(turn)).map((p) => [p.index, p.at]));
  step = { perm, arcs };
  byLayer.set(key, step);
  return step;
}

/**
 * Where each dot of a layer sits when that layer is turned by `angle` radians about its
 * positive axis, exactly as the 3D layer is. Whole quarter turns land exactly on sticker
 * places; in between, dots follow the same arcs as a completed turn, so a layer held halfway
 * in 3D is shown halfway in 2D. Returns positions keyed by the dot's home index.
 */
export function layerPositionsAt(
  layout: CircularLayout,
  axis: Axis,
  layer: number,
  angle: number,
): Map<number, Point> {
  const { perm, arcs } = quarterStep(layout, axis, layer);
  const quarters = angle / (Math.PI / 2);
  // Tiny rounding errors shouldn't turn "exactly one quarter" into "almost two".
  const whole = Math.floor(quarters + 1e-9);
  const part = Math.max(0, quarters - whole);

  const positions = new Map<number, Point>();
  for (let i = 0; i < 54; i++) {
    if (perm[i] === i) continue;
    // Whole quarters first (permutations repeat every four), then part of the next one.
    let at = i;
    const steps = ((whole % 4) + 4) % 4;
    for (let k = 0; k < steps; k++) at = perm[at];
    const s = layout.stickers[at];
    positions.set(i, part < 1e-9 ? [s.x, s.y] : arcs.get(at)!(part));
  }
  return positions;
}

/**
 * The inverse, for dragging in 2D: how many clockwise-on-screen quarter turns (fractional) put
 * the grabbed dot `deltaAngle` radians further clockwise around its circle than it started.
 * Quarter steps cover different angles (one can cross the circle's empty far side), so this
 * walks them one at a time rather than assuming 90° each.
 */
export function quartersForDrag(
  layout: CircularLayout,
  circleKey: string,
  index: number,
  deltaAngle: number,
): number {
  const circle = layout.circles.find((c) => c.key === circleKey)!;
  const perm = turnPermutation(moveToTurn(circle.clockwise));
  const inverse = new Array<number>(54);
  perm.forEach((to, from) => (inverse[to] = from));
  const angleOf = (i: number) =>
    Math.atan2(layout.stickers[i].y - circle.cy, layout.stickers[i].x - circle.cx);
  /** Clockwise screen angle from dot place a to place b, in (0, 2π]. */
  const clockwise = (a: number, b: number) => {
    const d = (angleOf(b) - angleOf(a)) % TAU;
    return d <= 0 ? d + TAU : d;
  };

  let remaining = deltaAngle;
  let quarters = 0;
  let at = index;
  for (let guard = 0; guard < 400; guard++) {
    if (remaining >= 0) {
      const span = clockwise(at, perm[at]);
      if (remaining <= span) return quarters + remaining / span;
      remaining -= span;
      at = perm[at];
      quarters += 1;
    } else {
      const back = inverse[at];
      const span = clockwise(back, at);
      if (-remaining <= span) return quarters + remaining / span;
      remaining += span;
      at = back;
      quarters -= 1;
    }
  }
  return quarters;
}
