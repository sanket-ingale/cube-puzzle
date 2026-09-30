import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { COLOR_LETTER, STANDARD_PALETTE } from '../cube/colors';
import type { Color } from '../cube/model';
import { COLOR_OF_FACE, type FaceletState } from '../cube/facelets';
import { formatMove, invertMove, moveToTurn, type Move } from '../cube/moves';
import { beginLiveTurn, endLiveTurn, updateLiveTurn } from '../game/liveTurn';
import type { ActiveMove, Grab } from '../game/store';
import { layerMotion } from '../game/turnProgress';
import { layerPositionsAt, quartersForDrag } from './animation';
import { buildLayout, FACE_OF_INDEX, type LayerCircle, type StickerNode } from './layout';

const STICKER_RADIUS = 13;
const CONTROL_RADIUS = 14;
/** Invisible touch area around each arrow button, larger than the drawn button. */
const CONTROL_HIT_RADIUS = 17;
/** A press this close to a sticker (in SVG units) grabs it, so fingers needn't be exact. */
const GRAB_RADIUS = 24;
/** How far a sticker must be dragged before it counts as a turn, in screen pixels. */
const DRAG_THRESHOLD_PX = 8;

const LAYOUT = buildLayout();
const CIRCLE_BY_KEY = Object.fromEntries(LAYOUT.circles.map((c) => [c.key, c]));

const LAYER_NAMES: Record<string, string> = {
  'x-1': 'L', x0: 'M', x1: 'R', 'y-1': 'D', y0: 'E', y1: 'U', 'z-1': 'B', z0: 'S', z1: 'F',
};

/**
 * A 270° arc with an arrowhead, drawn as a path so it doesn't depend on the font having the
 * ↻ glyph. Drawn clockwise; the counter-clockwise icon is its mirror image.
 */
function rotateIcon(cx: number, cy: number, r: number) {
  const a0 = (-150 * Math.PI) / 180;
  const a1 = (120 * Math.PI) / 180;
  const at = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = at(a0);
  const [x1, y1] = at(a1);
  // Direction of travel at the arc's end, and the radial direction there.
  const [tx, ty] = [-Math.sin(a1), Math.cos(a1)];
  const [nx, ny] = [Math.cos(a1), Math.sin(a1)];
  const head = [
    [x1 + tx * 3.5, y1 + ty * 3.5],
    [x1 - tx * 1.2 + nx * 3.2, y1 - ty * 1.2 + ny * 3.2],
    [x1 - tx * 1.2 - nx * 3.2, y1 - ty * 1.2 - ny * 3.2],
  ];
  return {
    arc: `M ${x0} ${y0} A ${r} ${r} 0 1 1 ${x1} ${y1}`,
    head: head.map((p) => p.join(',')).join(' '),
  };
}


/**
 * Which way along which of its two circles a sticker was dragged. The circle whose tangent at
 * the sticker best matches the drag wins, and the drag's sign picks clockwise or not.
 */
function moveForDrag(sticker: StickerNode, drag: [number, number]): { circle: LayerCircle; move: Move } {
  let best = { circle: CIRCLE_BY_KEY[sticker.circles[0]], score: 0 };
  for (const key of sticker.circles) {
    const circle = CIRCLE_BY_KEY[key];
    const angle = Math.atan2(sticker.y - circle.cy, sticker.x - circle.cx);
    // Clockwise tangent on screen (SVG's y axis points down).
    const score = (-Math.sin(angle) * drag[0] + Math.cos(angle) * drag[1]) / Math.hypot(...drag);
    if (Math.abs(score) > Math.abs(best.score)) best = { circle, score };
  }
  const { circle, score } = best;
  return { circle, move: score > 0 ? circle.clockwise : invertMove(circle.clockwise) };
}

interface CircularViewProps {
  cubeState: FaceletState;
  /** Receives standard notation, e.g. 'F' or "F'". */
  onMoveDispatch: (move: string) => void;
  /** Dims the controls and ignores input, e.g. while a scramble plays. */
  disabled?: boolean;
  /** The move animating right now, if any: its circle is highlighted and its dots slide. */
  activeMove?: ActiveMove | null;
  /** A layer being held by a drag in either view: its dots follow the layer's live angle. */
  grab?: Grab | null;
  /** A suggested next move, whose circle is marked. */
  hintMove?: Move | null;
  /** Sticker colours, shared with the 3D view. */
  palette?: Record<Color, string>;
  /** Show each sticker's colour initial (W, Y, G, B, R, O). */
  letters?: boolean;
  /** Stickers to light up, by index: a lesson's piece and its target spot. */
  marks?: Map<number, 'piece' | 'target'>;
}

function CircleControl({
  circle,
  clockwise,
  disabled,
  onMoveDispatch,
  onHover,
}: {
  circle: LayerCircle;
  clockwise: boolean;
  disabled: boolean;
  onMoveDispatch: (move: string) => void;
  onHover: (key: string | null) => void;
}) {
  const [x, y] = clockwise ? circle.controls.cw : circle.controls.ccw;
  const move = formatMove(clockwise ? circle.clockwise : invertMove(circle.clockwise));
  const icon = rotateIcon(x, y, 6.5);
  const fire = () => !disabled && onMoveDispatch(move);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fire();
    }
  };
  const label = `Turn the ${LAYER_NAMES[circle.key]} layer ${clockwise ? 'clockwise' : 'counter-clockwise'} on screen (${move})`;

  return (
    <g
      className="circle-control"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      onClick={fire}
      onKeyDown={onKeyDown}
      onPointerEnter={() => onHover(circle.key)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(circle.key)}
      onBlur={() => onHover(null)}
    >
      <title>{move}</title>
      <circle className="hit" cx={x} cy={y} r={CONTROL_HIT_RADIUS} />
      <circle className="face" cx={x} cy={y} r={CONTROL_RADIUS} />
      <g className="icon" transform={clockwise ? undefined : `translate(${2 * x} 0) scale(-1 1)`}>
        <path d={icon.arc} />
        <polygon points={icon.head} />
      </g>
    </g>
  );
}

/**
 * The cube as nine intersecting layer circles. Every sticker sits where its two layers' circles
 * cross, so turning a layer slides the stickers on that circle along it. Colours are read from
 * `cubeState` by index, and each of the 54 stickers is drawn exactly once.
 */
export const CircularView = memo(function CircularView({
  cubeState,
  onMoveDispatch,
  disabled = false,
  activeMove = null,
  grab = null,
  hintMove = null,
  palette = STANDARD_PALETTE,
  letters = false,
  marks,
}: CircularViewProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const endDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => endDrag.current?.(), []);

  const hintCircle = useMemo(() => {
    if (!hintMove) return null;
    const { axis, layer } = moveToTurn(hintMove);
    return `${axis}${layer}`;
  }, [hintMove]);

  // The layer moving right now, in either view: a move animating, or a layer held by a drag.
  const motion = useMemo(() => {
    if (activeMove) {
      const { axis, layer } = moveToTurn(activeMove.move);
      return { id: activeMove.id, axis, layer, key: `${axis}${layer}`, from: activeMove.from ?? 0 };
    }
    if (grab) return { id: grab.id, axis: grab.axis, layer: grab.layer, key: `${grab.axis}${grab.layer}`, from: 0 };
    return null;
  }, [activeMove, grab]);
  const activeCircle = motion?.key ?? null;

  // Dots are moved directly on the DOM each frame, so following the 3D layer never re-renders
  // React. They sit wherever the 3D layer's angle puts them, including part-way through a turn.
  const dots = useRef(new Map<number, SVGGElement>());
  const rendered = useRef<typeof motion>(null);

  // Runs before paint whenever a move commits (new colours) or the moving layer changes, so
  // the dots snap back home in the same frame the new colours appear.
  useLayoutEffect(() => {
    rendered.current = motion;
    for (const el of dots.current.values()) el.removeAttribute('transform');
  }, [cubeState, motion]);

  useEffect(() => {
    if (!motion) return;
    let frame = 0;
    const tick = () => {
      const current = rendered.current;
      if (current && current.id === motion.id) {
        // Until the 3D view publishes this motion's first frame, use where it starts from.
        const angle = layerMotion.id === motion.id ? layerMotion.angle : motion.from;
        for (const [index, [x, y]] of layerPositionsAt(LAYOUT, motion.axis, motion.layer, angle)) {
          const el = dots.current.get(index);
          if (!el) continue;
          const home = LAYOUT.stickers[index];
          el.setAttribute('transform', `translate(${x - home.x} ${y - home.y})`);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [motion]);

  /**
   * Grabs the sticker nearest the press. Once the drag picks one of its two circles, that
   * layer is held live: the dot stays under the pointer along its circle, the 3D layer turns
   * with it, and letting go settles on the nearest quarter turn (or springs back).
   */
  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (disabled || !e.isPrimary || (e.target as Element).closest('.circle-control')) return;
    const svg = e.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const toSvg = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(matrix.inverse());
    const point = toSvg(e.clientX, e.clientY);
    let sticker: StickerNode | null = null;
    let nearest = GRAB_RADIUS;
    for (const s of LAYOUT.stickers) {
      const d = Math.hypot(s.x - point.x, s.y - point.y);
      if (d < nearest) [sticker, nearest] = [s, d];
    }
    // Centre stickers are fixed reference points: grabbing one does nothing.
    if (!sticker || sticker.isCentre) return;
    const grabbed = sticker;
    e.preventDefault();
    const start: [number, number] = [e.clientX, e.clientY];
    const pointerId = e.pointerId;
    let decided = false;
    let live: { circle: LayerCircle; sign: number; last: number; swept: number } | null = null;

    const angleAround = (circle: LayerCircle, x: number, y: number) => {
      const p = toSvg(x, y);
      return Math.atan2(p.y - circle.cy, p.x - circle.cx);
    };

    const onMove = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const drag: [number, number] = [ev.clientX - start[0], ev.clientY - start[1]];

      if (!decided) {
        if (Math.hypot(...drag) < DRAG_THRESHOLD_PX) return;
        decided = true;
        const { circle, move } = moveForDrag(grabbed, drag);
        setHovered(circle.key);
        // Something is still moving: fall back to one quarter turn per drag.
        if (!beginLiveTurn(circle.axis, circle.layer, ev.timeStamp)) {
          onMoveDispatch(formatMove(move));
          return;
        }
        live = {
          circle,
          // Clockwise on screen is this sign of rotation about the layer's axis.
          sign: Math.sign(moveToTurn(circle.clockwise).quarterTurns),
          last: angleAround(circle, start[0], start[1]),
          swept: 0,
        };
      }

      if (!live) return;
      // Track how far the pointer has gone round the circle, unwrapping past ±180°.
      const now = angleAround(live.circle, ev.clientX, ev.clientY);
      live.swept += Math.atan2(Math.sin(now - live.last), Math.cos(now - live.last));
      live.last = now;
      const quarters = quartersForDrag(LAYOUT, live.circle.key, grabbed.stateIndex, live.swept);
      updateLiveTurn(quarters * live.sign * (Math.PI / 2), ev.timeStamp);
    };
    const onUp = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (live) endLiveTurn(ev.timeStamp, ev.type === 'pointercancel');
      live = null;
      finish();
    };
    const finish = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setHovered(null);
      endDrag.current = null;
    };

    endDrag.current?.();
    endDrag.current = finish;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const [minX, minY, width, height] = LAYOUT.viewBox;

  return (
    <svg
      className={disabled ? 'circular-view disabled' : 'circular-view'}
      viewBox={`${minX} ${minY} ${width} ${height}`}
      role="group"
      aria-label="Circular 2D view of the cube"
      onPointerDown={onPointerDown}
    >
      <g className="layer-circles">
        {LAYOUT.circles.map((c) => {
          const state =
            c.key === activeCircle
              ? ' active'
              : c.key === hovered
                ? ' hovered'
                : c.key === hintCircle
                  ? ' hint'
                  : '';
          return (
            <circle
              key={c.key}
              className={`layer-circle${c.layer === 0 ? ' slice' : ''}${state}`}
              data-layer={LAYER_NAMES[c.key]}
              cx={c.cx}
              cy={c.cy}
              r={c.r}
            />
          );
        })}
      </g>

      <g className="stickers">
        {LAYOUT.stickers.map((s) => {
          const color = COLOR_OF_FACE[cubeState[s.stateIndex]];
          return (
            // The dot and its letter move together during a turn.
            <g
              key={s.id}
              className="sticker-group"
              ref={(el) => {
                if (el) dots.current.set(s.stateIndex, el);
                else dots.current.delete(s.stateIndex);
              }}
            >
              <circle
                className={['sticker', s.isCentre && 'centre', marks?.get(s.stateIndex)].filter(Boolean).join(' ')}
                data-index={s.stateIndex}
                data-id={s.id}
                cx={s.x}
                cy={s.y}
                r={STICKER_RADIUS}
                fill={palette[color]}
              />
              {letters && (
                <text className="sticker-letter" x={s.x} y={s.y} dominantBaseline="central" textAnchor="middle">
                  {COLOR_LETTER[color]}
                </text>
              )}
            </g>
          );
        })}
        {/* Face names mark the centres; with letters on, the centres show colours instead. */}
        {!letters &&
          LAYOUT.stickers
            .filter((s) => s.isCentre)
            .map((s) => (
              <text key={`${s.id}-label`} className="face-label" x={s.x} y={s.y} dominantBaseline="central" textAnchor="middle">
                {FACE_OF_INDEX(s.stateIndex)}
              </text>
            ))}
      </g>

      <g className="controls">
        {LAYOUT.circles.flatMap((c) =>
          [false, true].map((clockwise) => (
            <CircleControl
              key={`${c.key}-${clockwise}`}
              circle={c}
              clockwise={clockwise}
              disabled={disabled}
              onMoveDispatch={onMoveDispatch}
              onHover={setHovered}
            />
          )),
        )}
      </g>
    </svg>
  );
});
