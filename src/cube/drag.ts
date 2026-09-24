import { AXIS_INDEX, type Axis, type Turn, type Vec3 } from './model';

const AXES: Axis[] = ['x', 'y', 'z'];
/** The cube spans -1.5..1.5; anything this far out on an axis is on the outer surface. */
const SURFACE_THRESHOLD = 1.3;

export interface FaceHit {
  /** Outward normal of the face that was hit, e.g. [0, 0, 1] for the front. */
  normal: Vec3;
  /** Grid position of the cubie that was hit. */
  position: Vec3;
}

/** `+ 0` turns -0 into 0 so results compare cleanly. */
const toVec3 = (values: number[]) => values.map((n) => n + 0) as unknown as Vec3;
const unit = (axis: Axis, sign: number) => toVec3(AXES.map((a) => (a === axis ? sign : 0)));

const clampToGrid = (n: number) => Math.max(-1, Math.min(1, Math.round(n)));

/**
 * Works out which outer face and cubie a point on the cube's surface belongs to, from a point
 * in the cube's own coordinates. Returns null for hits that aren't on the outside, such as the
 * inner faces briefly visible while a layer is turning.
 */
export function faceHitFromPoint(point: Vec3): FaceHit | null {
  const axis = AXES.reduce((best, a) =>
    Math.abs(point[AXIS_INDEX[a]]) > Math.abs(point[AXIS_INDEX[best]]) ? a : best,
  );
  const value = point[AXIS_INDEX[axis]];
  if (Math.abs(value) < SURFACE_THRESHOLD) return null;

  const normal = unit(axis, Math.sign(value));
  // Step inward a little before rounding, so a point on the surface lands in its own cubie.
  const position = toVec3(point.map((n, i) => clampToGrid(n - normal[i] * 0.25)));
  return { normal, position };
}

/** The two directions that lie flat on a face, e.g. +x and +y for the front face. */
export function faceTangents(normal: Vec3): [Vec3, Vec3] {
  const [a, b] = AXES.filter((axis) => normal[AXIS_INDEX[axis]] === 0);
  return [unit(a, 1), unit(b, 1)];
}

/**
 * Picks the face direction the drag follows. `screenTangents` are the two face tangents as
 * they appear on screen (in pixels, y pointing down), in the same order as `faceTangents`.
 * The tangent whose screen direction best lines up with the drag wins; its sign follows the drag.
 */
export function pickDragDirection(
  tangents: [Vec3, Vec3],
  screenTangents: [[number, number], [number, number]],
  drag: [number, number],
): Vec3 | null {
  let bestDirection: Vec3 | null = null;
  let bestScore = -1;
  tangents.forEach((tangent, i) => {
    const [sx, sy] = screenTangents[i];
    const length = Math.hypot(sx, sy);
    if (length < 1e-6) return; // tangent points straight at the camera
    const alignment = (sx * drag[0] + sy * drag[1]) / (length * Math.hypot(drag[0], drag[1]));
    if (Math.abs(alignment) > bestScore) {
      bestScore = Math.abs(alignment);
      bestDirection = toVec3(tangent.map((n) => n * Math.sign(alignment)));
    }
  });
  return bestDirection;
}

/**
 * How many quarter turns a dragged layer settles on when released: the nearest whole number,
 * so letting go less than halfway springs back and a long drag can make a half turn.
 */
export function snapQuarterTurns(angle: number): number {
  return Math.round(angle / (Math.PI / 2)) + 0;
}

/** A quick flick (radians per second) counts as a turn even if it's let go early. */
const FLICK_SPEED = 5;
/** ...as long as the layer has moved at least this share of a quarter turn. */
const FLICK_MIN_QUARTER = 0.15;

/**
 * Where a released layer settles, allowing for flicks: a short fast drag in one direction
 * completes the quarter turn instead of springing back, which is how a real cube behaves.
 */
export function settleQuarterTurns(angle: number, velocity: number): number {
  const snapped = snapQuarterTurns(angle);
  const quarters = angle / (Math.PI / 2);
  const flicked =
    snapped === 0 &&
    Math.abs(quarters) >= FLICK_MIN_QUARTER &&
    Math.abs(velocity) >= FLICK_SPEED &&
    Math.sign(velocity) === Math.sign(angle);
  return flicked ? Math.sign(angle) : snapped;
}

/**
 * The layer turn that moves the grabbed sticker in the drag direction. Rotating about
 * `normal × direction` by +90° carries the face's outward point towards `direction`,
 * and the grabbed cubie's coordinate on that axis picks the layer.
 */
export function turnFromDrag({ normal, position }: FaceHit, direction: Vec3): Turn {
  const [nx, ny, nz] = normal;
  const [dx, dy, dz] = direction;
  const cross: Vec3 = [ny * dz - nz * dy, nz * dx - nx * dz, nx * dy - ny * dx];
  const axis = AXES.find((a) => cross[AXIS_INDEX[a]] !== 0)!;
  return {
    axis,
    layer: position[AXIS_INDEX[axis]] as Turn['layer'],
    quarterTurns: Math.sign(cross[AXIS_INDEX[axis]]),
  };
}
