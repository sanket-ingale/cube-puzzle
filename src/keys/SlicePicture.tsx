import type { TurnKey } from './keymap';

type Point = [number, number, number];

const COS30 = Math.cos(Math.PI / 6);
/** Isometric projection of the corner view: x goes down-right, y up, z down-left. */
const project = ([x, y, z]: Point): [number, number] => [(x - z) * COS30, (x + z) * 0.5 - y];
const svgPoints = (points: Point[]) => points.map((p) => project(p).map((c) => c.toFixed(2)).join(',')).join(' ');

const AXIS = { right: 0, top: 1, left: 2 } as const;
const RANGE = [-1, 0, 1] as const;

interface Tile {
  corners: Point[];
  /** The cubie the tile belongs to, in the corner view's own coordinates. */
  cubie: Point;
}

const quad = (origin: Point, u: Point, v: Point): Point[] =>
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ].map(([i, j]) => origin.map((o, k) => o + u[k] * i + v[k] * j) as Point);

// The three visible faces: top (y = 1.5), left (z = 1.5) and right (x = 1.5).
const TILES: Tile[] = RANGE.flatMap((a) =>
  RANGE.flatMap((b) => [
    { corners: quad([a - 0.5, 1.5, b - 0.5], [1, 0, 0], [0, 0, 1]), cubie: [a, 1, b] as Point },
    { corners: quad([a - 0.5, b - 0.5, 1.5], [1, 0, 0], [0, 1, 0]), cubie: [a, b, 1] as Point },
    { corners: quad([1.5, a - 0.5, b - 0.5], [0, 1, 0], [0, 0, 1]), cubie: [1, a, b] as Point },
  ]),
);

/** Where the arrow runs for each key, drawn in the direction a plain (unreversed) press turns. */
function arrowPath({ along, layer }: TurnKey): Point[] {
  if (along === 'right') return [[layer, 1.15, 1.5], [layer, -1.15, 1.5]];
  if (along === 'left') return [[1.5, 1.15, layer], [1.5, -1.15, layer]];
  return [[-1.15, layer, 1.5], [1.5, layer, 1.5], [1.5, layer, -1.15]];
}

/**
 * A small corner view of the cube for a touch-screen turn button: the slice the button turns is
 * filled in, and an arrow shows which way it goes (flipped while Reverse is on).
 */
export function SlicePicture({ turnKey, reversed }: { turnKey: TurnKey; reversed: boolean }) {
  const axis = AXIS[turnKey.along];
  const path = arrowPath(turnKey).map(project);
  if (reversed) path.reverse();
  const [tipX, tipY] = path[path.length - 1];
  const [fromX, fromY] = path[path.length - 2];
  const angle = Math.atan2(tipY - fromY, tipX - fromX);
  const head = [0.62, -0.62].map((spread) => {
    const a = angle + Math.PI + spread;
    return `${(tipX + Math.cos(a) * 0.7).toFixed(2)},${(tipY + Math.sin(a) * 0.7).toFixed(2)}`;
  });

  return (
    <svg className="slice-picture" viewBox="-3 -3.2 6 6.4" aria-hidden="true">
      {TILES.map(({ corners, cubie }, i) => (
        <polygon
          key={i}
          points={svgPoints(corners)}
          className={cubie[axis] === turnKey.layer ? 'tile on' : 'tile'}
        />
      ))}
      <polyline className="slice-arrow" points={path.map((p) => p.join(',')).join(' ')} />
      <polyline className="slice-arrow" points={`${head[0]} ${tipX},${tipY} ${head[1]}`} />
    </svg>
  );
}
