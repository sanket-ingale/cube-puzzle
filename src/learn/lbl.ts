import { faceletIndex, type FaceletColor, type FaceletState } from '../cube/facelets';
import type { Vec3 } from '../cube/model';
import { parseMoves, simplifyMoves, type Move } from '../cube/moves';
import { sameFrame, type ViewFrame } from '../keys/frame';
import { applyAllToFacelets, applyToFacelets, framesWithTop, heldMoveToReal, heldState, realIndices } from './view';

/**
 * The beginner's layer-by-layer method, as a solver that plans the way a person would: one
 * piece or one case at a time, with a short setup and one of a handful of named algorithms.
 *
 * Everything is planned holding the cube with the yellow centre on top (so the white cross
 * and first layer end up on the bottom) and read from the centres, so it works after slice
 * turns have moved them. In a holding, F is the face on the left of the corner view and R the
 * face on the right, so every algorithm is done where it can be seen.
 */

export type Stage =
  | 'cross'
  | 'corners'
  | 'middle'
  | 'yellowCross'
  | 'yellowEdges'
  | 'cornerPlace'
  | 'cornerTwist'
  | 'done';

export const STAGES: Exclude<Stage, 'done'>[] = [
  'cross',
  'corners',
  'middle',
  'yellowCross',
  'yellowEdges',
  'cornerPlace',
  'cornerTwist',
];

export type StepKind =
  | 'petal'
  | 'turnDown'
  | 'corner'
  | 'cornerOut'
  | 'edgeRight'
  | 'edgeLeft'
  | 'edgeOut'
  | 'yellowCross'
  | 'yellowEdges'
  | 'cornerPlace'
  | 'twist'
  | 'alignTop';

export interface Algorithm {
  id: 'sexy' | 'edgeRight' | 'edgeLeft' | 'cross' | 'sune' | 'niklas' | 'twist';
  moves: Move[];
}

const alg = (id: Algorithm['id'], moves: string): Algorithm => ({ id, moves: parseMoves(moves) });

export const ALGORITHMS = {
  sexy: alg('sexy', "R U R' U'"),
  edgeRight: alg('edgeRight', "U R U' R' U' F' U F"),
  edgeLeft: alg('edgeLeft', "U' F' U F U R U' R'"),
  cross: alg('cross', "F R U R' U' F'"),
  sune: alg('sune', "R U R' U R U2 R'"),
  niklas: alg('niklas', "U R U' L' U R' U' L"),
  twist: alg('twist', "R' D' R D"),
} as const;

export interface Step {
  stage: Exclude<Stage, 'done'>;
  kind: StepKind;
  /** How to hold the cube for this step (yellow on top). */
  frame: ViewFrame;
  /** Moves before the algorithm, as held (usually turns of the top). */
  setup: Move[];
  algorithm: Algorithm | null;
  /** How many times in a row the algorithm is done. */
  times: number;
  /** Moves after the algorithm, as held. */
  after: Move[];
  /** Real sticker indices of the piece being worked on, and of where it's going. */
  piece: number[];
  target: number[];
  /** The piece's colours, e.g. white and red for an edge (as solved-face letters). */
  colours: FaceletColor[];
}

/** Every move of a step, as held. */
export const heldMoves = (step: Step): Move[] => [
  ...step.setup,
  ...Array.from({ length: step.times }, () => step.algorithm?.moves ?? []).flat(),
  ...step.after,
];

/** Every move of a step, as real moves; merged where the setup runs into the algorithm unless `exact`. */
export const realMoves = (step: Step, exact = false): Move[] =>
  (exact ? heldMoves(step) : simplifyMoves(heldMoves(step))).map((m) => heldMoveToReal(m, step.frame));

// ---------- Pieces, in held terms ----------

type Face = FaceletColor;
const AXIS_FACES: [Face, Face][] = [
  ['R', 'L'],
  ['U', 'D'],
  ['F', 'B'],
];
const NAME_ORDER: Face[] = ['U', 'D', 'F', 'B', 'R', 'L'];

interface Slot {
  name: string;
  /** The faces the piece shows, with the sticker index on each. */
  stickers: { face: Face; index: number }[];
}

function slotAt(position: Vec3): Slot {
  const stickers = position.flatMap((c, axis) => {
    if (c === 0) return [];
    const face = AXIS_FACES[axis][c > 0 ? 0 : 1];
    return [{ face, index: faceletIndex(face, position) }];
  });
  stickers.sort((a, b) => NAME_ORDER.indexOf(a.face) - NAME_ORDER.indexOf(b.face));
  return { name: stickers.map((s) => s.face).join(''), stickers };
}

const RANGE = [-1, 0, 1];
const ALL_SLOTS = RANGE.flatMap((x) => RANGE.flatMap((y) => RANGE.map((z) => slotAt([x, y, z])))).filter(
  (s) => s.stickers.length >= 2,
);
const SLOTS = Object.fromEntries(ALL_SLOTS.map((s) => [s.name, s])) as Record<string, Slot>;
const slot = (name: string) => SLOTS[name];

const TOP_EDGES = ['UF', 'UR', 'UB', 'UL'];
const BOTTOM_EDGES = ['DF', 'DR', 'DB', 'DL'];
const MIDDLE_EDGES = ['FR', 'FL', 'BR', 'BL'];
const TOP_CORNERS = ['UFR', 'UBR', 'UBL', 'UFL'];
const BOTTOM_CORNERS = ['DFR', 'DBR', 'DBL', 'DFL'];
const EDGES = [...TOP_EDGES, ...BOTTOM_EDGES, ...MIDDLE_EDGES];

const centre = (s: FaceletState, face: Face) => s[['U', 'R', 'F', 'D', 'L', 'B'].indexOf(face) * 9 + 4];
const colourOn = (s: FaceletState, slotName: string, face: Face) => s[slot(slotName).stickers.find((x) => x.face === face)!.index];
const colours = (s: FaceletState, slotName: string) => slot(slotName).stickers.map((x) => s[x.index]);
const indices = (slotName: string) => slot(slotName).stickers.map((x) => x.index);
const pieceSolved = (s: FaceletState, slotName: string) => slot(slotName).stickers.every((x) => s[x.index] === centre(s, x.face));
const sideFace = (slotName: string) => slot(slotName).stickers.find((x) => x.face !== 'U' && x.face !== 'D')!.face;

const white = (s: FaceletState) => centre(s, 'D');
const yellow = (s: FaceletState) => centre(s, 'U');

const uTurns = (k: number): Move[] => (k % 4 === 0 ? [] : [{ face: 'U', amount: k % 4 === 2 ? 2 : k % 4 === 1 ? 1 : -1 }]);

/**
 * Where a piece is now, found by its colours (each piece's set is unique): its sticker indices,
 * in the same terms as the state. Used to keep a piece lit up while it moves.
 */
export function findPiece(state: FaceletState, pieceColours: FaceletColor[]): number[] {
  const want = pieceColours.slice().sort().join('');
  const found = ALL_SLOTS.find((sl) => sl.stickers.length === pieceColours.length && colours(state, sl.name).sort().join('') === want);
  return found ? indices(found.name) : [];
}

// ---------- Stage checks, in held terms ----------

export const crossDone = (s: FaceletState) => BOTTOM_EDGES.every((e) => pieceSolved(s, e));
export const firstLayerDone = (s: FaceletState) => crossDone(s) && BOTTOM_CORNERS.every((c) => pieceSolved(s, c));
export const twoLayersDone = (s: FaceletState) => firstLayerDone(s) && MIDDLE_EDGES.every((e) => pieceSolved(s, e));
export const yellowCrossDone = (s: FaceletState) => twoLayersDone(s) && TOP_EDGES.every((e) => colourOn(s, e, 'U') === yellow(s));

/** How many turns of the top line its edges up with their centres, or null if none does. */
function topAlignment(s: FaceletState): number | null {
  for (let k = 0; k < 4; k++) {
    const t = applyAllToFacelets(s, uTurns(k));
    if (TOP_EDGES.every((e) => pieceSolved(t, e))) return k;
  }
  return null;
}

export const yellowEdgesDone = (s: FaceletState) => yellowCrossDone(s) && topAlignment(s) !== null;

const cornerPlaced = (s: FaceletState, c: string) => {
  const want = slot(c).stickers.map((x) => centre(s, x.face)).sort().join('');
  return colours(s, c).sort().join('') === want;
};

export function cornersPlacedDone(s: FaceletState): boolean {
  if (!yellowEdgesDone(s)) return false;
  const t = applyAllToFacelets(s, uTurns(topAlignment(s)!));
  return TOP_CORNERS.every((c) => cornerPlaced(t, c));
}

export const solvedHeld = (s: FaceletState) => s.every((c, i) => c === s[Math.floor(i / 9) * 9 + 4]);

function stageOfHeld(s: FaceletState): Stage {
  if (!crossDone(s)) return 'cross';
  if (!firstLayerDone(s)) return 'corners';
  if (!twoLayersDone(s)) return 'middle';
  if (!yellowCrossDone(s)) return 'yellowCross';
  if (!yellowEdgesDone(s)) return 'yellowEdges';
  if (!cornersPlacedDone(s)) return 'cornerPlace';
  if (!solvedHeld(s)) return 'cornerTwist';
  return 'done';
}

const TWIST = ALGORITHMS.twist.moves;

/**
 * Twisting the last corners (R' D' R D, again and again) mixes up the first two layers until
 * the last corner is done. This finds the holding that's mid-way through, if any: repeating
 * the algorithm a few more times would put the first two layers back.
 */
function twistInProgress(state: FaceletState): ViewFrame | null {
  for (const frame of framesWithTop(state, 'D')) {
    let s = heldState(state, frame);
    for (let m = 1; m <= 5; m++) {
      s = applyAllToFacelets(s, TWIST);
      if (twoLayersDone(s) && cornersPlacedDone(s)) return frame;
    }
  }
  return null;
}

export interface StageInfo {
  stage: Stage;
  /** Set while the last corners are being twisted: the holding they're being twisted in. */
  twistFrame: ViewFrame | null;
}

/** Which stage of the method a (real) cube is at. */
export function detectStage(state: FaceletState): StageInfo {
  const frame = framesWithTop(state, 'D')[0];
  const stage = stageOfHeld(heldState(state, frame));
  if (stage === 'cross' || stage === 'corners' || stage === 'middle') {
    const twistFrame = twistInProgress(state);
    if (twistFrame) return { stage: 'cornerTwist', twistFrame };
  }
  return { stage, twistFrame: null };
}

// ---------- Planning ----------

interface Candidate {
  step: Step;
  length: number;
}

function makeStep(
  stage: Step['stage'],
  kind: StepKind,
  frame: ViewFrame,
  setup: Move[],
  algorithm: Algorithm | null,
  times: number,
  after: Move[],
  pieceHeld: number[],
  targetHeld: number[],
  pieceColours: FaceletColor[],
): Candidate {
  const step: Step = {
    stage,
    kind,
    frame,
    setup,
    algorithm,
    times,
    after,
    piece: realIndices(pieceHeld, frame),
    target: realIndices(targetHeld, frame),
    colours: pieceColours,
  };
  return { step, length: heldMoves(step).length };
}

const best = (candidates: Candidate[], prefer: ViewFrame | null): Step | null => {
  if (candidates.length === 0) return null;
  const score = (c: Candidate) => c.length * 2 + (prefer && sameFrame(c.step.frame, prefer) ? 0 : 1);
  return candidates.reduce((a, b) => (score(b) < score(a) ? b : a)).step;
};

/** Which top-layer slot a piece ends up in after k turns of the top. */
function afterTopTurns(slotName: string, k: number, s: FaceletState): string {
  // Mark the piece's stickers and follow them: F stands in for "marked", U for the rest.
  const marked = new Set(indices(slotName));
  const probe = applyAllToFacelets(
    s.map((_, i): FaceletColor => (marked.has(i) ? 'F' : 'U')),
    uTurns(k),
  );
  return ALL_SLOTS.find((sl) => sl.stickers.length === marked.size && sl.stickers.every((x) => probe[x.index] === 'F'))!.name;
}

// Cross, part one: the daisy. White edges go up around the yellow centre, white side up.

const isWhiteEdge = (s: FaceletState, e: string) => colours(s, e).includes(white(s));
const petal = (s: FaceletState, e: string) => TOP_EDGES.includes(e) && colourOn(s, e, 'U') === white(s);
const goodCrossEdges = (s: FaceletState) =>
  EDGES.filter((e) => isWhiteEdge(s, e) && (petal(s, e) || (BOTTOM_EDGES.includes(e) && pieceSolved(s, e))));

const FACES: Face[] = ['U', 'D', 'F', 'B', 'R', 'L'];
const OPPOSITE: Record<Face, Face> = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R' };
const SEARCH_MOVES: Move[] = FACES.flatMap((face) => [1, -1, 2].map((amount) => ({ face, amount }) as Move));

/** Shortest moves that bring one more white edge into the daisy (or the cross) and keep the rest. */
function searchPetal(s: FaceletState, maxDepth = 6): Move[] | null {
  const before = goodCrossEdges(s).length;
  const goal = (t: FaceletState) => goodCrossEdges(t).length > before;
  const path: Move[] = [];
  const dfs = (t: FaceletState, depth: number): boolean => {
    if (depth === 0) return goal(t);
    const last = path[path.length - 1];
    for (const m of SEARCH_MOVES) {
      const face = m.face as Face;
      if (last && (face === last.face || (OPPOSITE[face] === last.face && FACES.indexOf(face) < FACES.indexOf(last.face as Face))))
        continue;
      path.push(m);
      if (dfs(applyToFacelets(t, m), depth - 1)) return true;
      path.pop();
    }
    return false;
  };
  for (let depth = 1; depth <= maxDepth; depth++) if (dfs(s, depth)) return path.slice();
  return null;
}

function planCross(state: FaceletState, frames: ViewFrame[], prefer: ViewFrame | null): Step | null {
  const frame = frames.find((f) => prefer && sameFrame(f, prefer)) ?? frames[0];
  const s = heldState(state, frame);
  const whiteEdges = EDGES.filter((e) => isWhiteEdge(s, e));
  const good = goodCrossEdges(s);

  if (whiteEdges.some((e) => !good.includes(e))) {
    const moves = searchPetal(s);
    if (!moves) return null;
    const t = applyAllToFacelets(s, moves);
    const landed = goodCrossEdges(t).find((e) => !good.map((g) => colours(s, g).sort().join('')).includes(colours(t, e).sort().join('')))!;
    const pieceColours = colours(t, landed);
    const from = whiteEdges.find((e) => colours(s, e).sort().join('') === pieceColours.slice().sort().join(''))!;
    return makeStep('cross', 'petal', frame, moves, null, 1, [], indices(from), indices(landed), colours(s, from)).step;
  }

  // Part two: each petal turns down to the bottom once its side colour matches the centre below.
  const candidates: Candidate[] = [];
  for (const f of frames) {
    const h = heldState(state, f);
    for (const e of TOP_EDGES) {
      if (!petal(h, e)) continue;
      const side = colourOn(h, e, sideFace(e));
      for (let k = 0; k < 4; k++) {
        if (afterTopTurns(e, k, h) !== 'UF' || centre(h, 'F') !== side) continue;
        candidates.push(
          makeStep('cross', 'turnDown', f, uTurns(k), null, 1, [{ face: 'F', amount: 2 }], indices(e), indices('DF'), colours(h, e)),
        );
      }
    }
  }
  return best(candidates, prefer);
}

// First-layer corners: bring each white corner above its slot, then R U R' U' until it's in.

const isWhiteCorner = (s: FaceletState, c: string) => colours(s, c).includes(white(s));

function repeatUntil(s: FaceletState, moves: Move[], done: (t: FaceletState) => boolean, max: number): number | null {
  let t = s;
  for (let n = 1; n <= max; n++) {
    t = applyAllToFacelets(t, moves);
    if (done(t)) return n;
  }
  return null;
}

function planCorners(state: FaceletState, frames: ViewFrame[], prefer: ViewFrame | null): Step | null {
  const candidates: Candidate[] = [];
  const sexy = ALGORITHMS.sexy;
  for (const f of frames) {
    const s = heldState(state, f);
    const keep = (t: FaceletState) => crossDone(t) && BOTTOM_CORNERS.every((c) => !pieceSolved(s, c) || pieceSolved(t, c));
    for (const c of TOP_CORNERS) {
      if (!isWhiteCorner(s, c)) continue;
      const others = colours(s, c).filter((x) => x !== white(s)).sort().join('');
      if ([centre(s, 'F'), centre(s, 'R')].sort().join('') !== others) continue;
      for (let k = 0; k < 4; k++) {
        if (afterTopTurns(c, k, s) !== 'UFR') continue;
        const t = applyAllToFacelets(s, uTurns(k));
        const n = repeatUntil(t, sexy.moves, (x) => pieceSolved(x, 'DFR') && keep(x), 6);
        if (n) candidates.push(makeStep('corners', 'corner', f, uTurns(k), sexy, n, [], indices(c), indices('DFR'), colours(s, c)));
      }
    }
  }
  const step = best(candidates, prefer);
  if (step) return step;

  // No white corner on top: take a stuck one out of the bottom first.
  for (const f of frames) {
    const s = heldState(state, f);
    if (isWhiteCorner(s, 'DFR') && !pieceSolved(s, 'DFR')) {
      candidates.push(makeStep('corners', 'cornerOut', f, [], sexy, 1, [], indices('DFR'), indices('UFR'), colours(s, 'DFR')));
    }
  }
  return best(candidates, prefer);
}

// Middle-layer edges: line the edge up with its centre, then send it right or left.

function planMiddle(state: FaceletState, frames: ViewFrame[], prefer: ViewFrame | null): Step | null {
  const candidates: Candidate[] = [];
  for (const f of frames) {
    const s = heldState(state, f);
    const keep = (t: FaceletState) => firstLayerDone(t) && MIDDLE_EDGES.every((e) => !pieceSolved(s, e) || pieceSolved(t, e));
    for (const e of TOP_EDGES) {
      const top = colourOn(s, e, 'U');
      const side = colourOn(s, e, sideFace(e));
      if (top === yellow(s) || side === yellow(s)) continue;
      // Right: the edge sits on F matching its centre and goes to FR. Left: it sits on R and goes to FR.
      const cases: [StepKind, string, Face, Face, Algorithm][] = [
        ['edgeRight', 'UF', 'F', 'R', ALGORITHMS.edgeRight],
        ['edgeLeft', 'UR', 'R', 'F', ALGORITHMS.edgeLeft],
      ];
      for (const [kind, at, sideOn, topTo, algorithm] of cases) {
        if (centre(s, sideOn) !== side || centre(s, topTo) !== top) continue;
        for (let k = 0; k < 4; k++) {
          if (afterTopTurns(e, k, s) !== at) continue;
          const t = applyAllToFacelets(applyAllToFacelets(s, uTurns(k)), algorithm.moves);
          if (pieceSolved(t, 'FR') && keep(t)) {
            candidates.push(makeStep('middle', kind, f, uTurns(k), algorithm, 1, [], indices(e), indices('FR'), colours(s, e)));
          }
        }
      }
    }
  }
  const step = best(candidates, prefer);
  if (step) return step;

  // Every top edge has yellow: pop a stuck middle edge out to the top first.
  for (const f of frames) {
    const s = heldState(state, f);
    if (!pieceSolved(s, 'FR')) {
      candidates.push(makeStep('middle', 'edgeOut', f, [], ALGORITHMS.edgeRight, 1, [], indices('FR'), indices('UF'), colours(s, 'FR')));
    }
  }
  return best(candidates, prefer);
}

// The last layer: one case at a time, trying each way of holding the cube and a turn of the top.

const topYellowEdges = (s: FaceletState) => TOP_EDGES.filter((e) => colourOn(s, e, 'U') === yellow(s));

/** 0 for the cross, then line, L and dot: how many algorithms the top is from its cross, at most. */
function crossPatternRank(s: FaceletState): number {
  const yes = topYellowEdges(s);
  if (yes.length === 4) return 0;
  if (yes.length === 0) return 3;
  const opposite = (yes.includes('UF') && yes.includes('UB')) || (yes.includes('UL') && yes.includes('UR'));
  return opposite ? 1 : 2;
}

function planYellowCross(state: FaceletState, frames: ViewFrame[], prefer: ViewFrame | null): Step | null {
  const candidates: Candidate[] = [];
  for (const f of frames) {
    const s = heldState(state, f);
    // The rule taught: an L goes at the back-left of the top, a line runs left to right.
    const yes = topYellowEdges(s);
    const rank = crossPatternRank(s);
    if (rank === 2 && !(yes.includes('UB') && yes.includes('UL'))) continue;
    if (rank === 1 && !(yes.includes('UL') && yes.includes('UR'))) continue;
    const t = applyAllToFacelets(s, ALGORITHMS.cross.moves);
    if (!twoLayersDone(t)) continue;
    // The holding that leaves the top closest to its cross: a line straight to the cross,
    // an L to a line, a dot to an L.
    const pieces = topYellowEdges(s).flatMap((e) => indices(e));
    const c = makeStep('yellowCross', 'yellowCross', f, [], ALGORITHMS.cross, 1, [], pieces, TOP_EDGES.flatMap(indices), []);
    candidates.push({ ...c, length: crossPatternRank(t) });
  }
  return best(candidates, prefer);
}

const matchedTopEdges = (s: FaceletState) => TOP_EDGES.filter((e) => pieceSolved(s, e));

/**
 * The rule taught: turn the top until two edges match their centres. If they're side by side,
 * hold them at the back and on the right; if they're opposite, hold the cube any way. Then the
 * algorithm, and a turn of the top if that finishes it.
 */
function planYellowEdges(state: FaceletState, frames: ViewFrame[], prefer: ViewFrame | null): Step | null {
  const adjacent: Candidate[] = [];
  const opposite: Candidate[] = [];
  const other: Candidate[] = [];
  for (const f of frames) {
    const s = heldState(state, f);
    for (let k = 0; k < 4; k++) {
      const set = applyAllToFacelets(s, uTurns(k));
      const t = applyAllToFacelets(set, ALGORITHMS.sune.moves);
      const align = topAlignment(t);
      const matched = matchedTopEdges(set);
      const c = makeStep(
        'yellowEdges',
        'yellowEdges',
        f,
        uTurns(k),
        ALGORITHMS.sune,
        1,
        align !== null ? uTurns(align) : [],
        matched.flatMap(indices),
        TOP_EDGES.flatMap(indices),
        [],
      );
      if (matched.length === 2 && matched.includes('UB') && matched.includes('UR')) adjacent.push(c);
      else if (matched.length === 2 && (matched.includes('UF') ? matched.includes('UB') : matched.includes('UL'))) opposite.push(c);
      else other.push(c);
    }
  }
  return best(adjacent, prefer) ?? best(opposite, prefer) ?? best(other, prefer);
}

function planCornerPlace(state: FaceletState, frames: ViewFrame[], prefer: ViewFrame | null): Step | null {
  const candidates: Candidate[] = [];
  for (const f of frames) {
    const s0 = heldState(state, f);
    const k = topAlignment(s0);
    if (k === null) continue;
    const s = applyAllToFacelets(s0, uTurns(k));
    for (const times of [1, 2]) {
      let t = s;
      for (let n = 0; n < times; n++) t = applyAllToFacelets(t, ALGORITHMS.niklas.moves);
      const placed = TOP_CORNERS.filter((c) => cornerPlaced(t, c)).length;
      if (!TOP_EDGES.every((e) => pieceSolved(t, e)) || !twoLayersDone(t)) continue;
      const progress = placed === 4 ? 0 : placed >= 1 ? 10 : 20;
      const anchor = TOP_CORNERS.filter((c) => cornerPlaced(s, c)).flatMap(indices);
      const c = makeStep('cornerPlace', 'cornerPlace', f, uTurns(k), ALGORITHMS.niklas, times, [], anchor, TOP_CORNERS.flatMap(indices), []);
      candidates.push({ ...c, length: c.length + progress });
    }
  }
  return best(candidates, prefer);
}

const cornerYellowUp = (s: FaceletState, c: string) => colourOn(s, c, 'U') === yellow(s);

function planCornerTwist(state: FaceletState, frames: ViewFrame[], prefer: ViewFrame | null, fixed: ViewFrame | null): Step | null {
  const candidates: Candidate[] = [];
  for (const f of fixed ? [fixed] : frames) {
    const s = heldState(state, f);
    for (let k = 0; k < 4; k++) {
      const set = applyAllToFacelets(s, uTurns(k));
      if (cornerYellowUp(set, 'UFR')) continue;
      const n = repeatUntil(set, TWIST, (t) => cornerYellowUp(t, 'UFR'), 5);
      if (!n) continue;
      const c = makeStep('cornerTwist', 'twist', f, uTurns(k), ALGORITHMS.twist, n, [], indices(afterTopTurns('UFR', (4 - k) % 4, s)), indices('UFR'), colours(s, afterTopTurns('UFR', (4 - k) % 4, s)));
      candidates.push(c);
    }
    // Every corner is yellow side up: one last turn of the top finishes the cube.
    if (TOP_CORNERS.every((c) => cornerYellowUp(s, c))) {
      for (let k = 1; k < 4; k++) {
        if (solvedHeld(applyAllToFacelets(s, uTurns(k)))) {
          candidates.push(makeStep('cornerTwist', 'alignTop', f, uTurns(k), null, 1, [], TOP_CORNERS.flatMap(indices), [], []));
        }
      }
    }
  }
  return best(candidates, fixed ?? prefer);
}

/**
 * The next step of the method for a (real) cube, or null once it's solved. `prefer` is how the
 * cube is being held now: when a step can be done from several holdings, that one wins.
 */
export function planStep(state: FaceletState, prefer: ViewFrame | null = null): Step | null {
  const frames = framesWithTop(state, 'D');
  const { stage, twistFrame } = detectStage(state);
  switch (stage) {
    case 'cross':
      return planCross(state, frames, prefer);
    case 'corners':
      return planCorners(state, frames, prefer);
    case 'middle':
      return planMiddle(state, frames, prefer);
    case 'yellowCross':
      return planYellowCross(state, frames, prefer);
    case 'yellowEdges':
      return planYellowEdges(state, frames, prefer);
    case 'cornerPlace':
      return planCornerPlace(state, frames, prefer);
    case 'cornerTwist':
      return planCornerTwist(state, frames, prefer, twistFrame);
    case 'done':
      return null;
  }
}

/** Whole solutions, for tests and for setting up practice cubes. */
export function planSolve(
  state: FaceletState,
  until: Stage = 'done',
  maxSteps = 80,
): { steps: Step[]; state: FaceletState } | null {
  const steps: Step[] = [];
  let s = state;
  for (let i = 0; i < maxSteps; i++) {
    const info = detectStage(s);
    if (STAGE_INDEX[info.stage] >= STAGE_INDEX[until]) return { steps, state: s };
    const step = planStep(s, steps[steps.length - 1]?.frame ?? null);
    if (!step) return info.stage === 'done' ? { steps, state: s } : null;
    steps.push(step);
    s = applyAllToFacelets(s, realMoves(step));
  }
  return null;
}

export const STAGE_INDEX: Record<Stage, number> = {
  cross: 0,
  corners: 1,
  middle: 2,
  yellowCross: 3,
  yellowEdges: 4,
  cornerPlace: 5,
  cornerTwist: 6,
  done: 7,
};

