const COS30 = Math.cos(Math.PI / 6);
/** Screen directions of the three cube axes in an isometric drawing. */
const X = [COS30, 0.5];
const Y = [0, -1];
const Z = [-COS30, 0.5];

type Vec = [number, number, number];
const project = ([a, b, c]: Vec) => [a * X[0] + b * Y[0] + c * Z[0], a * X[1] + b * Y[1] + c * Z[1]];

function quad(origin: Vec, u: Vec, v: Vec): string {
  return [[0, 0], [1, 0], [1, 1], [0, 1]]
    .map(([i, j]) => project(origin.map((o, k) => o + u[k] * i + v[k] * j) as Vec))
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
}

// The solved cube as seen in the default view: white on top, green on the left, red on the right.
const FACES: { fill: string; tiles: string[] }[] = [
  { fill: 'var(--mark-top)', tiles: [] },
  { fill: 'var(--mark-left)', tiles: [] },
  { fill: 'var(--mark-right)', tiles: [] },
];
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    FACES[0].tiles.push(quad([i - 1.5, 1.5, j - 1.5], [1, 0, 0], [0, 0, 1]));
    FACES[1].tiles.push(quad([i - 1.5, j - 1.5, 1.5], [1, 0, 0], [0, 1, 0]));
    FACES[2].tiles.push(quad([1.5, i - 1.5, j - 1.5], [0, 1, 0], [0, 0, 1]));
  }
}
const OUTLINE = [
  quad([-1.5, 1.5, -1.5], [3, 0, 0], [0, 0, 3]),
  quad([-1.5, -1.5, 1.5], [3, 0, 0], [0, 3, 0]),
  quad([1.5, -1.5, -1.5], [0, 3, 0], [0, 0, 3]),
];

/** The app's mark: a small solved cube, outlined in the page's ink. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="-3.3 -3.3 6.6 6.6" aria-hidden="true">
      {OUTLINE.map((points) => (
        <polygon key={points} points={points} fill="var(--plastic)" stroke="var(--ink)" strokeWidth="0.7" strokeLinejoin="round" />
      ))}
      {FACES.map(({ fill, tiles }) =>
        tiles.map((points) => (
          <polygon key={points} points={points} fill={fill} stroke="var(--plastic)" strokeWidth="0.26" strokeLinejoin="round" />
        )),
      )}
    </svg>
  );
}
