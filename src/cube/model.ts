export type Axis = 'x' | 'y' | 'z';
export type Vec3 = readonly [number, number, number];
export type Color = 'white' | 'yellow' | 'green' | 'blue' | 'red' | 'orange';

export interface Sticker {
  /** World-space direction the sticker faces, e.g. [0, 1, 0] for the top face. */
  normal: Vec3;
  color: Color;
}

export interface Cubie {
  /** Stable identity so React can key meshes across moves. */
  id: number;
  /** Integer grid position, each component in {-1, 0, 1}. */
  position: Vec3;
  stickers: Sticker[];
}

export type CubeState = readonly Cubie[];

/**
 * A geometric layer rotation. `quarterTurns` is signed using the right-hand rule
 * around the positive axis: +1 is 90° counter-clockwise when looking from +axis.
 */
export interface Turn {
  axis: Axis;
  layer: -1 | 0 | 1;
  quarterTurns: number;
}

export const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

/** Standard Western color scheme: white top, green front. */
const FACE_COLORS: { normal: Vec3; color: Color }[] = [
  { normal: [1, 0, 0], color: 'red' }, // R
  { normal: [-1, 0, 0], color: 'orange' }, // L
  { normal: [0, 1, 0], color: 'white' }, // U
  { normal: [0, -1, 0], color: 'yellow' }, // D
  { normal: [0, 0, 1], color: 'green' }, // F
  { normal: [0, 0, -1], color: 'blue' }, // B
];

export function createSolvedCube(): CubeState {
  const cubies: Cubie[] = [];
  let id = 0;
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue; // hidden core
        const position: Vec3 = [x, y, z];
        const stickers = FACE_COLORS.filter(({ normal }) =>
          normal.some((n, i) => n !== 0 && n === position[i]),
        ).map(({ normal, color }) => ({ normal, color }));
        cubies.push({ id: id++, position, stickers });
      }
    }
  }
  return cubies;
}

/** Rotate an integer vector by a number of 90° steps around an axis (right-hand rule). */
export function rotateVec(v: Vec3, axis: Axis, quarterTurns: number): Vec3 {
  const steps = ((quarterTurns % 4) + 4) % 4;
  let [x, y, z] = v;
  for (let i = 0; i < steps; i++) {
    if (axis === 'x') [y, z] = [-z, y];
    else if (axis === 'y') [x, z] = [z, -x];
    else [x, y] = [-y, x];
  }
  // `+ 0` normalizes -0 to 0 so equality checks stay simple.
  return [x + 0, y + 0, z + 0];
}

export function isInLayer(cubie: Cubie, axis: Axis, layer: number): boolean {
  return cubie.position[AXIS_INDEX[axis]] === layer;
}

export function applyTurn(state: CubeState, turn: Turn): CubeState {
  const { axis, layer, quarterTurns } = turn;
  return state.map((cubie) => {
    if (!isInLayer(cubie, axis, layer)) return cubie;
    return {
      ...cubie,
      position: rotateVec(cubie.position, axis, quarterTurns),
      stickers: cubie.stickers.map((s) => ({
        ...s,
        normal: rotateVec(s.normal, axis, quarterTurns),
      })),
    };
  });
}

/** Solved when every one of the six outward directions shows a single color. */
export function isSolved(state: CubeState): boolean {
  const colorByFace = new Map<string, Color>();
  for (const cubie of state) {
    for (const { normal, color } of cubie.stickers) {
      const key = normal.join(',');
      const seen = colorByFace.get(key);
      if (seen === undefined) colorByFace.set(key, color);
      else if (seen !== color) return false;
    }
  }
  return true;
}
