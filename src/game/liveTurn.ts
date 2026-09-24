import { settleQuarterTurns } from '../cube/drag';
import type { Axis } from '../cube/model';
import { turnToMove } from '../cube/moves';
import { useCubeStore } from './store';
import { liveDrag } from './turnProgress';

/**
 * Turning a layer by hand, shared by the 3D and 2D views so both feel identical: grab a layer,
 * update its angle as the finger moves, and let go to settle on the nearest quarter turn (a
 * quick flick completes the turn; letting go early springs back).
 */

/** Only movement this recent counts towards a flick when the finger lifts. */
const FLICK_WINDOW_MS = 100;

let current: {
  axis: Axis;
  layer: -1 | 0 | 1;
  sample: { time: number; angle: number };
  velocity: number;
} | null = null;

/** Grabs a layer if nothing else is moving. Returns false if it couldn't. */
export function beginLiveTurn(axis: Axis, layer: -1 | 0 | 1, time: number): boolean {
  if (!useCubeStore.getState().startGrab({ axis, layer })) return false;
  liveDrag.angle = 0;
  liveDrag.springBack = false;
  current = { axis, layer, sample: { time, angle: 0 }, velocity: 0 };
  return true;
}

/** The held layer's new angle, in radians about its positive axis. */
export function updateLiveTurn(angle: number, time: number) {
  if (!current) return;
  const dt = (time - current.sample.time) / 1000;
  if (dt > 0.008) {
    current.velocity = (angle - current.sample.angle) / dt;
    current.sample = { time, angle };
  }
  liveDrag.angle = angle;
}

/** Lets go. Settles on a whole number of quarter turns, or springs back (also on cancel). */
export function endLiveTurn(time: number, cancelled = false) {
  if (!current) return;
  const { axis, layer } = current;
  // A finger that stopped before lifting isn't flicking, whatever its last speed was.
  const velocity = time - current.sample.time > FLICK_WINDOW_MS ? 0 : current.velocity;
  current = null;
  const quarters = cancelled ? 0 : settleQuarterTurns(liveDrag.angle, velocity);
  if (quarters === 0) {
    // The 3D view eases the layer back to rest, then ends the grab.
    liveDrag.springBack = true;
    return;
  }
  useCubeStore.getState().releaseGrab({
    move: turnToMove({ axis, layer, quarterTurns: quarters }),
    from: liveDrag.angle,
    to: quarters * (Math.PI / 2),
  });
}
