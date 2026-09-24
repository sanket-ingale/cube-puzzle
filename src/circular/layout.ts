import { AXIS_INDEX, type Axis } from '../cube/model';
import { turnToMove, type Move } from '../cube/moves';
import { FACE_ORDER, stickerAt, turnPermutation } from '../cube/facelets';

/**
 * The intersecting-circles view. Each axis has a family of three concentric circles, one per
 * layer (x: L/M/R, y: D/E/U, z: B/S/F). Every sticker is moved by exactly two layers, so it
 * sits where those two circles cross, and a layer turn slides the 12 stickers on its circle
 * three places along it. Each face's 9 stickers form the patch where two families overlap.
 */

type Point = [number, number];

export interface StickerNode {
  /** e.g. 'F4', matching the manual's node ids. */
  id: string;
  /** Index (0–53) into the 54-sticker state. */
  stateIndex: number;
  x: number;
  y: number;
  /** Keys of the two layer circles this sticker lies on. */
  circles: [string, string];
  /** Centre stickers are fixed reference points and don't respond to input. */
  isCentre: boolean;
}

export interface LayerCircle {
  /** e.g. 'x1' for the R layer. */
  key: string;
  axis: Axis;
  layer: -1 | 0 | 1;
  cx: number;
  cy: number;
  r: number;
  /** The move that slides this circle's stickers clockwise on screen. */
  clockwise: Move;
  /** The 12 stickers on the circle, in clockwise screen order. */
  ring: number[];
  /** Where the clockwise and counter-clockwise buttons sit, on the circle's outer arc. */
  controls: { cw: Point; ccw: Point };
}

export interface CircularLayout {
  viewBox: [number, number, number, number];
  circles: LayerCircle[];
  stickers: StickerNode[];
}

const AXES: Axis[] = ['x', 'y', 'z'];

/** Distance between family centres. Everything else is sized relative to it. */
const SPACING = 150;
/** Radius of each family's middle-layer circle, and the step between its three circles. */
const BASE_RADIUS = 150;
const LAYER_GAP = 32;
/** Arc length between a circle's two buttons, in SVG units. */
const CONTROL_SPREAD = 36;
const PADDING = 22;

/**
 * Family centres on an equilateral triangle: y (U) at the top, z (F) bottom-left and
 * x (R) bottom-right. The +1 layer of every family is its outer circle, and each face's
 * + side (U, R, F) is the crossing nearer the third centre, which puts U, F and R in the
 * inner triangle and D, B and L outside it.
 */
const CENTROID: Point = [400, 300];
const CENTERS: Record<Axis, Point> = {
  y: [CENTROID[0], CENTROID[1] - SPACING / Math.sqrt(3)],
  z: [CENTROID[0] - SPACING / 2, CENTROID[1] + SPACING / (2 * Math.sqrt(3))],
  x: [CENTROID[0] + SPACING / 2, CENTROID[1] + SPACING / (2 * Math.sqrt(3))],
};

const radiusOf = (layer: number) => BASE_RADIUS + layer * LAYER_GAP;
const circleKey = (axis: Axis, layer: number) => `${axis}${layer}`;
const angleAround = (center: Point, [x, y]: Point) => Math.atan2(y - center[1], x - center[0]);

/** The two points where two circles cross. */
function intersections(c1: Point, r1: number, c2: Point, r2: number): [Point, Point] {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(r1 * r1 - a * a);
  const mx = c1[0] + (a * dx) / d;
  const my = c1[1] + (a * dy) / d;
  return [
    [mx + (h * dy) / d, my - (h * dx) / d],
    [mx - (h * dy) / d, my + (h * dx) / d],
  ];
}

function placeSticker(index: number): StickerNode {
  const { face, position, normal } = stickerAt(index);
  const axis = AXES.find((a) => normal[AXIS_INDEX[a]] !== 0)!;
  const [b, c] = AXES.filter((a) => a !== axis);
  const layerB = position[AXIS_INDEX[b]];
  const layerC = position[AXIS_INDEX[c]];

  const points = intersections(CENTERS[b], radiusOf(layerB), CENTERS[c], radiusOf(layerC));
  const distance = ([x, y]: Point) => Math.hypot(x - CENTERS[axis][0], y - CENTERS[axis][1]);
  const [inner, outer] = distance(points[0]) < distance(points[1]) ? points : [points[1], points[0]];
  const [x, y] = normal[AXIS_INDEX[axis]] > 0 ? inner : outer;

  return {
    id: `${face}${index % 9}`,
    stateIndex: index,
    x,
    y,
    circles: [circleKey(b, layerB), circleKey(c, layerC)],
    isCentre: index % 9 === 4,
  };
}

function buildCircle(axis: Axis, layer: -1 | 0 | 1, stickers: StickerNode[]): LayerCircle {
  const center = CENTERS[axis];
  const r = radiusOf(layer);
  const key = circleKey(axis, layer);

  // SVG's y axis points down, so increasing angle runs clockwise on screen.
  const ring = stickers
    .filter((s) => s.circles.includes(key))
    .sort((p, q) => angleAround(center, [p.x, p.y]) - angleAround(center, [q.x, q.y]))
    .map((s) => s.stateIndex);

  // Find which turn direction carries each sticker three places clockwise along the ring.
  const perm = turnPermutation({ axis, layer, quarterTurns: 1 });
  const positiveIsClockwise = perm[ring[0]] === ring[3];
  const clockwise = turnToMove({ axis, layer, quarterTurns: positiveIsClockwise ? 1 : -1 });

  // Buttons sit on the arc facing away from the other families, where the circle is clear.
  const away = angleAround(CENTROID, center);
  const spread = CONTROL_SPREAD / 2 / r;
  const at = (angle: number): Point => [center[0] + r * Math.cos(angle), center[1] + r * Math.sin(angle)];

  return {
    key,
    axis,
    layer,
    cx: center[0],
    cy: center[1],
    r,
    clockwise,
    ring,
    controls: { cw: at(away + spread), ccw: at(away - spread) },
  };
}

export function buildLayout(): CircularLayout {
  const stickers = Array.from({ length: 54 }, (_, i) => placeSticker(i));
  const circles = AXES.flatMap((axis) =>
    ([-1, 0, 1] as const).map((layer) => buildCircle(axis, layer, stickers)),
  );

  const outer = radiusOf(1) + PADDING;
  const xs = AXES.flatMap((a) => [CENTERS[a][0] - outer, CENTERS[a][0] + outer]);
  const ys = AXES.flatMap((a) => [CENTERS[a][1] - outer, CENTERS[a][1] + outer]);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  const viewBox: CircularLayout['viewBox'] = [minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY];

  return { viewBox, circles, stickers };
}

/** Faces in index order, for labelling centre stickers. */
export const FACE_OF_INDEX = (index: number) => FACE_ORDER[Math.floor(index / 9)];
