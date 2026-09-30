import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Quaternion, type PerspectiveCamera } from 'three';
import { FreeControls } from './scene/FreeControls';
import { frameQuaternion, registerCamera } from './scene/view';
import { CircularPanel } from './circular/CircularPanel';
import { Cube } from './scene/Cube';
import { HelpDialog } from './ui/HelpDialog';
import { HistoryDialog } from './ui/HistoryDialog';
import { SettingsDialog } from './ui/SettingsDialog';
import { Celebration } from './ui/Celebration';
import { TurnKeys } from './keys/TurnKeys';
import { SessionCard, StatusBlock } from './ui/StatusCard';
import { Brand, Dock, MetaButtons, ResetViewButton, ViewSwitch } from './ui/Toolbar';
import { useUi } from './ui/uiStore';
import { NARROW_SCREEN, useMediaQuery } from './ui/useMediaQuery';
import { useThemeSetting } from './ui/theme';
import { useKeyboardControls } from './game/useKeyboardControls';
import { useRecordSolves } from './game/solves';
import { useFeedback } from './game/feedback';
import { useLearn, useLearnTracker } from './learn/learn';
import { LearnPanel } from './learn/LearnPanel';

const FOV = 40;
/** Roughly the cube's bounding radius, with a little breathing room. */
const CUBE_RADIUS = 2.6;
/**
 * Share of the view the cube may fill. On wide screens the toolbar and status card float over
 * the cube, so it's framed smaller; on phones they sit outside the view.
 */
const FILL_WIDE = 0.56;
const FILL_NARROW = 0.88;

/** Backs the camera off until the cube fits both the width and the height of the view. */
function useFitDistance() {
  const { width, height } = useThree((s) => s.size);
  const fill = useMediaQuery(NARROW_SCREEN) ? FILL_NARROW : FILL_WIDE;
  const halfFovTan = Math.tan(((FOV / 2) * Math.PI) / 180);
  const fitHeight = CUBE_RADIUS / (halfFovTan * fill);
  const fitWidth = CUBE_RADIUS / (halfFovTan * (width / height) * fill);
  return Math.max(fitHeight, fitWidth);
}

const VIEW_RESET_SECONDS = 0.35;
/** How far the camera may drift from its corner view before it counts as moved. */
const MOVED_ANGLE = 0.02;

interface Controls {
  addEventListener: (type: 'start' | 'change', listener: () => void) => void;
  removeEventListener: (type: 'start' | 'change', listener: () => void) => void;
}

/**
 * Keeps the camera on its corner view at the right distance, glides it to the view that
 * snapping picked, and notices when the player turns it away.
 */
function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const distance = useFitDistance();
  const resetRequest = useUi((s) => s.viewResetRequest);
  const glide = useRef<{ from: Quaternion; to: Quaternion; fromLength: number; t: number } | null>(null);
  const placed = useRef(false);

  useEffect(() => {
    registerCamera(camera);
    return () => registerCamera(null);
  }, [camera]);

  // Start on the current corner view, then keep the zoom fitted when the view changes size.
  useEffect(() => {
    if (!placed.current) {
      placed.current = true;
      const q = frameQuaternion(useUi.getState().viewFrame);
      camera.quaternion.copy(q);
      camera.up.set(0, 1, 0).applyQuaternion(q);
    }
    camera.position.set(0, 0, distance).applyQuaternion(camera.quaternion);
  }, [camera, distance]);

  // Snapping picked a corner view: glide there along the shortest turn.
  useEffect(() => {
    if (resetRequest === 0) return;
    glide.current = {
      from: camera.quaternion.clone(),
      to: frameQuaternion(useUi.getState().viewFrame),
      fromLength: camera.position.length(),
      t: 0,
    };
  }, [camera, resetRequest]);

  // Turning the cube by hand stops a glide; drifting away from the corner view counts as moved.
  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      glide.current = null;
    };
    const onChange = () => {
      const target = frameQuaternion(useUi.getState().viewFrame);
      const angle = 2 * Math.acos(Math.min(1, Math.abs(camera.quaternion.dot(target))));
      const zoomed = Math.abs(camera.position.length() - distance) > 0.05;
      if ((angle > MOVED_ANGLE || zoomed) && !useUi.getState().viewMoved) useUi.getState().setViewMoved(true);
    };
    controls.addEventListener('start', onStart);
    controls.addEventListener('change', onChange);
    return () => {
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('change', onChange);
    };
  }, [camera, controls, distance]);

  useFrame((_, delta) => {
    const g = glide.current;
    if (!g) return;
    g.t = Math.min(1, g.t + Math.min(delta, 1 / 30) / VIEW_RESET_SECONDS);
    const eased = 1 - (1 - g.t) ** 3;
    camera.quaternion.slerpQuaternions(g.from, g.to, eased);
    camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const length = g.fromLength + (distance - g.fromLength) * eased;
    camera.position.set(0, 0, length).applyQuaternion(camera.quaternion);
    if (g.t >= 1) {
      glide.current = null;
      useUi.getState().setViewMoved(false);
    }
  });

  return <FreeControls minDistance={5} maxDistance={Math.max(14, distance * 1.3)} />;
}

export function App() {
  useKeyboardControls();
  useRecordSolves();
  useFeedback();
  useLearnTracker();
  useThemeSetting();
  const viewMoved = useUi((s) => s.viewMoved);
  const circularOpen = useUi((s) => s.circularOpen);
  const narrow = useMediaQuery(NARROW_SCREEN);
  const learning = useLearn((s) => s.status !== 'off');

  // Each layout starts with its own default: the 2D view beside the cube on wide screens, and
  // the 3D cube on phones (where the 2D view would cover it). Resizing across the breakpoint,
  // e.g. widening a side panel, switches to that layout's default.
  useEffect(() => {
    useUi.getState().setCircularOpen(!narrow);
  }, [narrow]);

  const classes = ['app', narrow ? 'narrow' : 'wide', circularOpen && 'with-2d']
    .filter(Boolean)
    .join(' ');

  // Phones stack everything in one column around the cube; wider screens float the controls
  // over the cube and keep the 2D view, stats and key guide in a column beside it. The canvas
  // keeps its place in the tree either way, so it never remounts.
  return (
    <div className={classes}>
      {narrow && (
        <header className="app-header">
          <Brand />
          <MetaButtons />
        </header>
      )}
      {narrow && (learning ? <LearnPanel /> : <StatusBlock />)}
      {narrow && !circularOpen && !learning && <SessionCard />}
      <main className="stage" aria-label="3D cube">
        <div className="cube-shadow" aria-hidden="true" />
        <Canvas camera={{ position: [5, 5, 5], fov: FOV }} dpr={[1, 2]} gl={{ alpha: true }}>
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 8, 6]} intensity={1.6} />
          <directionalLight position={[-6, -4, -5]} intensity={0.5} />
          <Cube />
          <CameraRig />
        </Canvas>
        {narrow && circularOpen && (
          <div className="stage-2d">
            <CircularPanel />
          </div>
        )}
        <div className="stage-ui">
          <div className="stage-top">
            {!narrow && <Brand />}
            <div className="stage-tools">
              {viewMoved && <ResetViewButton />}
              <ViewSwitch />
              {!narrow && <MetaButtons />}
            </div>
          </div>
          {!narrow && !learning && <StatusBlock />}
          {!narrow && (
            <div className="stage-bottom">
              <Dock />
            </div>
          )}
        </div>
      </main>
      {narrow && !circularOpen && <TurnKeys />}
      {narrow && <Dock />}
      {!narrow && (
        <aside className="side">
          {learning && <LearnPanel />}
          {circularOpen && <CircularPanel />}
          <TurnKeys />
          <SessionCard />
        </aside>
      )}
      <HelpDialog />
      <HistoryDialog />
      <SettingsDialog />
      <Celebration />
    </div>
  );
}
