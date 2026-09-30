import type { Axis, Vec3 } from '../cube/model';

/** A cube axis with a direction, e.g. -x for the face that points left in the solved cube. */
export interface SignedAxis {
  axis: Axis;
  sign: 1 | -1;
}

/**
 * A corner view of the cube: which cube direction faces out of the right face, the top and the
 * left face. There are 24 of them (8 corners, each with 3 faces that can be on top), and none is
 * special; the turn keys follow whichever one the camera settles on.
 */
export interface ViewFrame {
  right: SignedAxis;
  top: SignedAxis;
  left: SignedAxis;
}

export type FrameSlot = keyof ViewFrame;

const AXES: Axis[] = ['x', 'y', 'z'];

export const toVector = ({ axis, sign }: SignedAxis): Vec3 =>
  AXES.map((a) => (a === axis ? sign : 0)) as unknown as Vec3;

function fromVector(v: Vec3): SignedAxis {
  const index = v.findIndex((c) => c !== 0);
  return { axis: AXES[index], sign: v[index] > 0 ? 1 : -1 };
}

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** The view the cube opens in: the corner between x (right), y (top) and z (left). */
export const DEFAULT_FRAME: ViewFrame = {
  right: { axis: 'x', sign: 1 },
  top: { axis: 'y', sign: 1 },
  left: { axis: 'z', sign: 1 },
};

const SIGNED: SignedAxis[] = AXES.flatMap((axis) => [
  { axis, sign: 1 as const },
  { axis, sign: -1 as const },
]);

/** All 24 corner views. Seen from outside, right, top and left always go around the same way. */
export const ALL_FRAMES: ViewFrame[] = SIGNED.flatMap((right) =>
  SIGNED.filter((top) => top.axis !== right.axis).map((top) => ({
    right,
    top,
    left: fromVector(cross(toVector(right), toVector(top))),
  })),
);

export const sameFrame = (a: ViewFrame, b: ViewFrame) =>
  (['right', 'top', 'left'] as const).every((slot) => a[slot].axis === b[slot].axis && a[slot].sign === b[slot].sign);
