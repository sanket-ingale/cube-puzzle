import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { AXIS_INDEX, isInLayer } from '../cube/model';
import { moveToTurn } from '../cube/moves';
import { useCubeStore } from '../game/store';
import { layerMotion, liveDrag } from '../game/turnProgress';
import { Cubie, useMarkPulse, useStickerAppearance } from './Cubie';
import { faceletIndex, faceOfNormal } from '../cube/facelets';
import { useLearnMarks } from '../learn/learn';
import { useUi } from '../ui/uiStore';
import { GuideArrow } from './GuideArrow';
import { useLearnNextMove } from '../learn/learn';
import { useDragToTurn } from './useDragToTurn';

const QUARTER_TURN_SECONDS = 0.18;
/** Queued moves play faster so long sequences don't drag on. */
const QUEUED_TURN_SECONDS = 0.08;
/**
 * The reset rewind aims to finish in about this long. Each turn gets the budget divided by
 * the turns still to play, clamped, so long rewinds run quick and then ease into the last turns.
 */
const REWIND_BUDGET_SECONDS = 2.4;
const REWIND_MIN_TURN_SECONDS = 0.14;
const REWIND_MAX_TURN_SECONDS = 0.3;
/** Scrambles play briskly but smoothly: 25 turns take about three seconds. */
const SCRAMBLE_TURN_SECONDS = 0.1;
/** The solver's moves and replays play slowly enough to follow. */
const SOLVE_TURN_SECONDS = 0.22;
const REPLAY_TURN_SECONDS = 0.3;
/** Length of the full-turn spin that marks a solve. */
const SOLVE_SPIN_SECONDS = 1.4;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** For settling a released drag: already moving, so it only slows down. */
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
/** Gentler than cubic: lower peak speed, so back-to-back turns flow instead of snapping. */
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Cubies in the turning layer render inside a pivot group that the animation rotates.
 * When the animation reaches its final angle, the move is committed to the model and the
 * layer re-renders at its new integer positions with no rotation. Both frames look the
 * same, so the hand-off is seamless and no floating-point error is ever stored.
 */
export function Cube() {
  const cubies = useCubeStore((s) => s.cubies);
  const active = useCubeStore((s) => s.active);
  const grab = useCubeStore((s) => s.grab);
  const queueLength = useCubeStore((s) => s.queue.length);
  const mode = useCubeStore((s) => s.mode);
  const lastSolve = useCubeStore((s) => s.lastSolve);
  const completeActive = useCubeStore((s) => s.completeActive);
  const releaseGrab = useCubeStore((s) => s.releaseGrab);
  const guideMove = useLearnNextMove();
  const learnMarks = useLearnMarks();
  useMarkPulse();
  const flash = useUi((s) => s.flash);
  const marksFor = (c: (typeof cubies)[number]) => {
    const lit = flash !== null && isInLayer(c, flash.axis, flash.layer);
    if (learnMarks.size === 0 && !lit) return '';
    return c.stickers
      .map(({ normal }) => {
        const mark = learnMarks.get(faceletIndex(faceOfNormal(normal), c.position));
        return mark === 'piece' ? 'p' : mark === 'target' ? 't' : lit ? 'w' : '-';
      })
      .join('');
  };

  const pivot = useRef<Group>(null);
  const whole = useRef<Group>(null);
  const progress = useRef({ moveId: -1, t: 0, done: false });
  const spin = useRef(1);
  const turn = active ? moveToTurn(active.move) : null;
  // The layer in the pivot: the animating move's, or the one a finger is holding.
  const layer = turn ?? grab;
  const onPointerDown = useDragToTurn(whole);
  useStickerAppearance();

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (lastSolve && !reducedMotion) spin.current = 0;
  }, [lastSolve]);

  useFrame((_, delta) => {
    // Cap the step so a dropped frame slows motion down instead of making it jump.
    const step = Math.min(delta, 1 / 30);

    if (spin.current < 1 && whole.current) {
      spin.current = Math.min(1, spin.current + step / SOLVE_SPIN_SECONDS);
      whole.current.rotation.y = easeInOutCubic(spin.current) * Math.PI * 2;
    }

    // A layer held by a drag follows the finger; let go early, it springs back to rest.
    if (grab && !active && pivot.current) {
      if (liveDrag.springBack) {
        liveDrag.angle *= Math.pow(0.0005, step); // eases out over about a fifth of a second
        if (Math.abs(liveDrag.angle) < 0.002) {
          liveDrag.angle = 0;
          liveDrag.springBack = false;
          releaseGrab(null);
        }
      }
      pivot.current.rotation[grab.axis] = liveDrag.angle;
      layerMotion.id = grab.id;
      layerMotion.angle = liveDrag.angle;
      return;
    }

    if (!active || !turn || !pivot.current) {
      layerMotion.id = -1;
      layerMotion.angle = 0;
      return;
    }

    const p = progress.current;
    if (p.moveId !== active.id) Object.assign(p, { moveId: active.id, t: 0, done: false });
    // Wait for React to render the next move before touching the pivot again.
    if (p.done) return;

    const target = turn.quarterTurns * (Math.PI / 2);
    const from = active.from ?? 0;
    const to = active.to ?? target;
    const perQuarter =
      mode === 'resetting'
        ? clamp(REWIND_BUDGET_SECONDS / (queueLength + 1), REWIND_MIN_TURN_SECONDS, REWIND_MAX_TURN_SECONDS)
        : mode === 'scrambling'
          ? SCRAMBLE_TURN_SECONDS
          : mode === 'solving'
            ? SOLVE_TURN_SECONDS
            : mode === 'replaying'
              ? REPLAY_TURN_SECONDS
              : queueLength > 0
                ? QUEUED_TURN_SECONDS
                : QUARTER_TURN_SECONDS;
    // A released drag only has the remaining distance to cover, so it settles quickly.
    const quarters = Math.abs(to - from) / (Math.PI / 2);
    const duration =
      active.from === undefined
        ? perQuarter * (quarters === 2 ? 1.5 : 1)
        : perQuarter * clamp(quarters, 0.35, 1.5);
    const ease = active.from !== undefined ? easeOutCubic : mode === 'play' ? easeInOutCubic : easeInOutSine;
    p.t = Math.min(1, p.t + step / duration);
    const angle = from + (to - from) * ease(p.t);
    pivot.current.rotation[turn.axis] = angle;
    // Shared with the 2D view, which draws its dots at exactly this angle.
    layerMotion.id = active.id;
    layerMotion.angle = angle;

    if (p.t >= 1) {
      p.done = true;
      completeActive();
    }
  });

  const turning = layer ? cubies.filter((c) => isInLayer(c, layer.axis, layer.layer)) : [];
  const resting = layer ? cubies.filter((c) => !isInLayer(c, layer.axis, layer.layer)) : cubies;
  // A move released from a drag starts at the angle the finger left it, from its first frame.
  const startRotation: [number, number, number] = [0, 0, 0];
  if (active?.from !== undefined && turn) startRotation[AXIS_INDEX[turn.axis]] = active.from;

  return (
    <group ref={whole} onPointerDown={onPointerDown}>
      {resting.map((c) => (
        <Cubie key={c.id} cubie={c} marks={marksFor(c)} />
      ))}
      {guideMove && !layer && <GuideArrow move={guideMove} />}
      {layer && (
        <group ref={pivot} key={active ? active.id : 'grab'} rotation={startRotation}>
          {turning.map((c) => (
            <Cubie key={c.id} cubie={c} marks={marksFor(c)} />
          ))}
        </group>
      )}
    </group>
  );
}
