import { describe, expect, it } from 'vitest';
import { createSolvedCube } from '../cube/model';
import { applyMoves, formatMoves, parseMoves, type Move } from '../cube/moves';
import { toFacelets } from '../cube/facelets';
import { generateScramble } from '../cube/scramble';
import { ALL_FRAMES } from '../keys/frame';
import { detectStage, planSolve, realMoves, STAGE_INDEX } from './lbl';
import { applyAllToFacelets, applyToFacelets, heldMoveToReal, heldState } from './view';

const MOVES = parseMoves("U U' U2 D D' D2 R R' R2 L L' L2 F F' F2 B B' B2 M E S M' E' S'");
const facelets = (moves: Move[]) => toFacelets(applyMoves(createSolvedCube(), moves));

describe('holding the cube', () => {
  it('a move made while holding the cube matches the real move', () => {
    const start = facelets(parseMoves("R U2 F' L D B2 M S'"));
    for (const frame of ALL_FRAMES) {
      for (const m of MOVES) {
        const viaReal = heldState(applyToFacelets(start, heldMoveToReal(m, frame)), frame);
        const viaHeld = applyToFacelets(heldState(start, frame), m);
        expect(viaReal).toEqual(viaHeld);
      }
    }
  });
});

function solveAndCheck(scramble: Move[]) {
  const start = facelets(scramble);
  const result = planSolve(start);
  expect(result, formatMoves(scramble)).not.toBeNull();
  const { steps } = result!;
  // Replaying the steps' real moves really solves the cube.
  const end = applyAllToFacelets(start, steps.flatMap((st) => realMoves(st)));
  expect(detectStage(end).stage).toBe('done');
  // Stages only move forward, except inside the corner twisting, which reports its own stage.
  let s = start;
  let last = 0;
  for (const step of steps) {
    const now = STAGE_INDEX[detectStage(s).stage];
    expect(now).toBeGreaterThanOrEqual(last);
    last = now;
    s = applyAllToFacelets(s, realMoves(step));
  }
  return { steps, moves: steps.flatMap((st) => realMoves(st)).length };
}

describe('beginner method', () => {
  it('solves a solved cube with no steps', () => {
    expect(planSolve(facelets([]))!.steps).toEqual([]);
  });

  it('solves 250 random scrambles, stage by stage', () => {
    let total = 0;
    let worst = 0;
    for (let i = 0; i < 250; i++) {
      const { moves } = solveAndCheck(generateScramble());
      total += moves;
      worst = Math.max(worst, moves);
    }
    // A beginner's solve is long, but not endless.
    expect(worst).toBeLessThan(400);
    expect(total / 250).toBeLessThan(250);
  });

  it('works from the centres after slice turns have moved them', () => {
    for (let i = 0; i < 40; i++) {
      solveAndCheck([...generateScramble(), ...parseMoves("M E' S2 M'")]);
    }
  });

  it('can stop at the start of any stage, for practice cubes', () => {
    for (const until of ['corners', 'middle', 'yellowCross', 'yellowEdges', 'cornerPlace', 'cornerTwist'] as const) {
      const result = planSolve(facelets(generateScramble()), until)!;
      expect(STAGE_INDEX[detectStage(result.state).stage]).toBeGreaterThanOrEqual(STAGE_INDEX[until]);
    }
  });

  it('recognises a cube part-way through twisting the last corners, and carries on', () => {
    let checked = 0;
    for (let i = 0; i < 40 && checked < 15; i++) {
      let s = facelets(generateScramble());
      const result = planSolve(s)!;
      for (const step of result.steps) {
        if (step.kind === 'twist' && step.times >= 2) {
          // Stop half-way through this corner: the first two layers are mixed up now.
          const partial = [...step.setup, ...step.algorithm!.moves].map((m) => heldMoveToReal(m, step.frame));
          const mid = applyAllToFacelets(s, partial);
          const info = detectStage(mid);
          expect(info.stage).toBe('cornerTwist');
          expect(info.twistFrame).toEqual(step.frame);
          const rest = planSolve(mid)!;
          expect(detectStage(rest.state).stage).toBe('done');
          checked++;
          break;
        }
        s = applyAllToFacelets(s, realMoves(step));
      }
    }
    expect(checked).toBeGreaterThan(5);
  });
});
