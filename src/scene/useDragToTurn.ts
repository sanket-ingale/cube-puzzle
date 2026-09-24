import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import { faceHitFromPoint, faceTangents, pickDragDirection, turnFromDrag } from '../cube/drag';
import type { Turn } from '../cube/model';
import { turnToMove } from '../cube/moves';
import { useCubeStore } from '../game/store';
import { beginLiveTurn, endLiveTurn, updateLiveTurn } from '../game/liveTurn';

/** How far the pointer must travel before a drag counts as a turn. */
const DRAG_THRESHOLD_PX = 10;
/** Finger travel for a quarter turn, in cubie widths on screen. */
const QUARTER_TURN_CUBIES = 1.2;

interface Controls {
  enabled: boolean;
}

/**
 * Returns a pointer-down handler for the cube group. A drag that starts on a sticker grabs the
 * layer it runs along, which then follows the finger and settles on the nearest quarter turn
 * when let go. A drag that starts on the background falls through to the orbit controls.
 */
export function useDragToTurn(cube: RefObject<Group | null>) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const endDrag = useRef<(() => void) | null>(null);

  useEffect(() => () => endDrag.current?.(), []);

  return useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const group = cube.current;
      const native = e.nativeEvent;
      if (!group || !native.isPrimary || (native.pointerType === 'mouse' && native.button !== 0)) return;
      if (useCubeStore.getState().mode !== 'play') return;

      // Work in the cube's own coordinates so the solve spin doesn't skew the result.
      const localPoint = group.worldToLocal(e.point.clone());
      const hit = faceHitFromPoint([localPoint.x, localPoint.y, localPoint.z]);
      if (!hit) return;

      e.stopPropagation();
      // Orbit controls saw this pointer-down first; disabling them stops the camera following.
      if (controls) controls.enabled = false;

      const toScreen = (local: Vector3): [number, number] => {
        const ndc = group.localToWorld(local.clone()).project(camera);
        return [((ndc.x + 1) / 2) * size.width, ((1 - ndc.y) / 2) * size.height];
      };
      const origin = toScreen(localPoint);
      const tangents = faceTangents(hit.normal);
      const screenTangents = tangents.map((t) => {
        const [x, y] = toScreen(localPoint.clone().add(new Vector3(...t).multiplyScalar(0.5)));
        return [x - origin[0], y - origin[1]];
      }) as [[number, number], [number, number]];

      const start = [native.clientX, native.clientY];
      let decided = false;
      let live: {
        turn: Turn;
        /** Screen direction (unit vector) of dragging the sticker the positive way. */
        unit: [number, number];
        pxPerRadian: number;
      } | null = null;

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== native.pointerId) return;
        const drag: [number, number] = [ev.clientX - start[0], ev.clientY - start[1]];

        if (!decided) {
          if (Math.hypot(drag[0], drag[1]) < DRAG_THRESHOLD_PX) return;
          decided = true;
          const direction = pickDragDirection(tangents, screenTangents, drag);
          if (!direction) return;
          const turn = turnFromDrag(hit, direction);
          // Something is still moving: fall back to one quarter turn per drag.
          if (!beginLiveTurn(turn.axis, turn.layer, ev.timeStamp)) {
            useCubeStore.getState().enqueue([turnToMove(turn)]);
            return;
          }
          // Map finger travel to angle: a quarter turn takes a little over one cubie's width
          // on screen, however far the cube is zoomed. (Following the sticker's true arc would
          // need about three times that, which feels sluggish.)
          const i = tangents.findIndex((t) => t.some((n, k) => n !== 0 && direction[k] !== 0));
          const sign = Math.sign(tangents[i].reduce((sum, n, k) => sum + n * direction[k], 0));
          const [sx, sy] = screenTangents[i];
          const pxPerUnit = Math.hypot(sx, sy) / 0.5;
          live = {
            turn,
            unit: [(sx * sign) / Math.hypot(sx, sy), (sy * sign) / Math.hypot(sx, sy)],
            pxPerRadian: (pxPerUnit * QUARTER_TURN_CUBIES) / (Math.PI / 2),
          };
        }

        if (!live) return;
        const along = drag[0] * live.unit[0] + drag[1] * live.unit[1];
        updateLiveTurn((Math.sign(live.turn.quarterTurns) * along) / live.pxPerRadian, ev.timeStamp);
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== native.pointerId) return;
        if (live) endLiveTurn(ev.timeStamp, ev.type === 'pointercancel');
        live = null;
        finish();
      };

      // Controls stay off until the pointer lifts, or the rest of the drag would orbit the camera.
      const finish = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        if (controls) controls.enabled = true;
        endDrag.current = null;
      };

      endDrag.current?.();
      endDrag.current = finish;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [cube, camera, size, controls],
  );
}
