import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { EventDispatcher, Quaternion, Vector3, type Camera } from 'three';

interface ControlEvents {
  start: object;
  change: object;
  end: object;
}

/** How far one drag across the shorter side of the view turns the cube. */
const TURN_PER_SIDE = Math.PI * 1.25;
const WHEEL_ZOOM = 0.0015;

/**
 * Free tumbling: dragging turns the cube about the axis at right angles to the drag, as if
 * rolling it under a finger. There are no poles and no fixed "up", so it can be turned upside
 * down or any other way. It stops when you let go. A wheel or a pinch zooms.
 *
 * Only the camera moves; the cube itself stays put. Setting `enabled` to false mid-drag (as a
 * sticker grab does) drops the gesture, so nothing is left half-held.
 */
export class FreeRotateControls extends EventDispatcher<ControlEvents> {
  enabled = true;
  minDistance = 5;
  maxDistance = 14;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: number | null = null;
  private active = false;

  constructor(
    private camera: Camera,
    private element: HTMLElement,
  ) {
    super();
    element.style.touchAction = 'none';
    element.addEventListener('pointerdown', this.onDown);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  dispose() {
    this.element.removeEventListener('pointerdown', this.onDown);
    this.element.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  }

  private onDown = (e: PointerEvent) => {
    if (!this.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.pinch = this.pointers.size === 2 ? this.spread() : null;
    if (!this.active) {
      this.active = true;
      this.dispatchEvent({ type: 'start' });
    }
  };

  private onMove = (e: PointerEvent) => {
    const last = this.pointers.get(e.pointerId);
    if (!last) return;
    // A sticker grab switched the controls off: that pointer belongs to the layer now.
    if (!this.enabled) {
      this.cancel();
      return;
    }
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last.x = e.clientX;
    last.y = e.clientY;

    if (this.pointers.size >= 2) {
      const spread = this.spread();
      if (this.pinch && spread > 0) this.zoomBy(this.pinch / spread);
      this.pinch = spread;
      return;
    }
    this.rotateBy(dx, dy);
  };

  private onUp = (e: PointerEvent) => {
    if (!this.pointers.delete(e.pointerId)) return;
    this.pinch = this.pointers.size === 2 ? this.spread() : null;
    if (this.pointers.size === 0) this.finish();
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    this.dispatchEvent({ type: 'start' });
    this.zoomBy(Math.exp(e.deltaY * WHEEL_ZOOM));
    this.dispatchEvent({ type: 'end' });
  };

  private cancel() {
    this.pointers.clear();
    this.pinch = null;
    this.finish();
  }

  private finish() {
    if (!this.active) return;
    this.active = false;
    this.dispatchEvent({ type: 'end' });
  }

  private spread() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private rotateBy(dx: number, dy: number) {
    const length = Math.hypot(dx, dy);
    if (length === 0) return;
    const side = Math.min(this.element.clientWidth, this.element.clientHeight) || 1;
    const angle = (length / side) * TURN_PER_SIDE;
    // Dragging right spins the cube about the screen's vertical axis, dragging down about its
    // horizontal one. Turning the camera the opposite way around the cube does the same thing.
    const axis = new Vector3(dy / length, dx / length, 0).applyQuaternion(this.camera.quaternion);
    const turn = new Quaternion().setFromAxisAngle(axis, -angle);
    this.camera.position.applyQuaternion(turn);
    this.camera.quaternion.premultiply(turn);
    this.camera.up.applyQuaternion(turn);
    this.dispatchEvent({ type: 'change' });
  }

  private zoomBy(factor: number) {
    const length = this.camera.position.length();
    const next = Math.min(this.maxDistance, Math.max(this.minDistance, length * factor));
    this.camera.position.setLength(next);
    this.dispatchEvent({ type: 'change' });
  }
}

/** Mounts the free controls as the scene's default controls. */
export function FreeControls({ minDistance, maxDistance }: { minDistance: number; maxDistance: number }) {
  const camera = useThree((s) => s.camera);
  const element = useThree((s) => s.gl.domElement);
  const set = useThree((s) => s.set);
  const controls = useMemo(() => new FreeRotateControls(camera, element), [camera, element]);

  useEffect(() => {
    set({ controls: controls as never });
    return () => {
      controls.dispose();
      set({ controls: null });
    };
  }, [controls, set]);

  useEffect(() => {
    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;
  }, [controls, minDistance, maxDistance]);

  return null;
}
