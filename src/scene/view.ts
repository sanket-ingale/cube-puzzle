import { Matrix4, Quaternion, Vector3, type Camera } from 'three';
import { ALL_FRAMES, toVector, type ViewFrame } from '../keys/frame';
import { useUi } from '../ui/uiStore';

const ORIGIN = new Vector3();
const vector = (v: readonly number[]) => new Vector3(v[0], v[1], v[2]);

/** The camera orientation for a corner view: looking down the corner, with the top face up. */
export function frameQuaternion(frame: ViewFrame): Quaternion {
  const top = vector(toVector(frame.top));
  const eye = vector(toVector(frame.right)).add(top).add(vector(toVector(frame.left))).normalize();
  const up = top.sub(eye.clone().multiplyScalar(top.dot(eye))).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(eye, ORIGIN, up));
}

const QUATERNIONS = ALL_FRAMES.map((frame) => ({ frame, q: frameQuaternion(frame) }));

/** The corner view that needs the smallest turn from a camera orientation. */
export function nearestFrame(orientation: Quaternion): ViewFrame {
  let best = QUATERNIONS[0];
  let bestDot = -1;
  for (const candidate of QUATERNIONS) {
    const dot = Math.abs(candidate.q.dot(orientation));
    if (dot > bestDot) {
      bestDot = dot;
      best = candidate;
    }
  }
  return best.frame;
}

/** The scene's camera, registered by the camera rig so snapping can happen outside React. */
let activeCamera: Camera | null = null;
export const registerCamera = (camera: Camera | null) => {
  activeCamera = camera;
};

/**
 * Settles the view on the nearest corner: the keys and hints switch to it at once, and the
 * camera glides there. Returns the view, so a key press can use it straight away.
 */
export function snapView(): ViewFrame {
  const ui = useUi.getState();
  if (!activeCamera) return ui.viewFrame;
  const frame = nearestFrame(activeCamera.quaternion);
  ui.setViewFrame(frame);
  ui.requestViewReset();
  return frame;
}

/** Glides the camera to a given corner view (e.g. how a lesson step is held). */
export function glideToFrame(frame: ViewFrame) {
  const ui = useUi.getState();
  ui.setViewFrame(frame);
  ui.requestViewReset();
}

/** Of some corner views, the one nearest to where the camera is now. */
export function nearestOf(frames: ViewFrame[]): ViewFrame | null {
  if (frames.length === 0) return null;
  if (!activeCamera) return frames[0];
  const q = activeCamera.quaternion;
  return frames.reduce((a, b) => (Math.abs(frameQuaternion(b).dot(q)) > Math.abs(frameQuaternion(a).dot(q)) ? b : a));
}
