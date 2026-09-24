import { FACE_ORDER, toFacelets, type FaceletColor } from '../cube/facelets';
import type { CubeState } from '../cube/model';

/**
 * The cube as a Kociemba string the solver accepts. Slice moves (M, E, S) move the centres,
 * but the solver needs each face's letter to match its centre, so every sticker is relabelled
 * by the face whose centre currently shows its colour. Moves are positional (R is whatever
 * layer is on the right now), so the solution applies to the cube exactly as it sits.
 */
export function solverInput(cubies: CubeState): string {
  const facelets = toFacelets(cubies);
  const faceOfCentreColour = new Map<FaceletColor, FaceletColor>(
    FACE_ORDER.map((face, f) => [facelets[f * 9 + 4], face]),
  );
  return facelets.map((colour) => faceOfCentreColour.get(colour)!).join('');
}

export const SOLVED_INPUT = FACE_ORDER.map((face) => face.repeat(9)).join('');
