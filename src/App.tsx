import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Quaternion, Vector3, type PerspectiveCamera } from 'three';
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
import { useGuideTracker } from './solver/guide';

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

/** The default view, which the turn keys are laid out for: looking down the corner of the top, left and right faces. */
const CORNER_VIEW = new Vector3(1, 1, 1).normalize();
const VIEW_RESET_SECONDS = 0.3;

interface Controls {
  enabled: boolean;
  enableDamping: boolean;
  update: () => void;
  addEventListener: (type: 'start', listener: () => void) => void;
  removeEventListener: (type: 'start', listener: () => void) => void;
}

function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const distance = useFitDistance();
  const resetRequest = useUi((s) => s.viewResetRequest);
  const glide = useRef<{ from: Vector3; fromLength: number; t: number } | null>(null);

  useEffect(() => {
    camera.position.setLength(distance);
  }, [camera, distance]);

  // A reset request glides the camera back to the corner view and the default zoom.
  useEffect(() => {
    if (resetRequest === 0) return;
    glide.current = { from: camera.position.clone().normalize(), fromLength: camera.position.length(), t: 0 };
  }, [camera, resetRequest]);

  // Any orbit or zoom by the player counts as moving the view.
  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      glide.current = null;
      useUi.getState().setViewMoved(true);
    };
    controls.addEventListener('start', onStart);
    return () => controls.removeEventListener('start', onStart);
  }, [controls]);

  useFrame((_, delta) => {
    const g = glide.current;
    if (!g) return;
    g.t = Math.min(1, g.t + Math.min(delta, 1 / 30) / VIEW_RESET_SECONDS);
    const eased = 1 - (1 - g.t) ** 3;
    // Turn the direction along the shortest arc, so the camera never passes through the cube.
    const turn = new Quaternion().setFromUnitVectors(g.from, CORNER_VIEW);
    const step = new Quaternion().slerp(turn, eased);
    const length = g.fromLength + (distance - g.fromLength) * eased;
    camera.position.copy(g.from).applyQuaternion(step).multiplyScalar(length);
    camera.lookAt(0, 0, 0);
    if (controls) {
      // Without damping, the controls drop any leftover spin instead of drifting afterwards.
      controls.enableDamping = false;
      controls.update();
      if (g.t >= 1) controls.enableDamping = true;
    }
    if (g.t >= 1) {
      glide.current = null;
      useUi.getState().setViewMoved(false);
    }
  });

  return (
    <OrbitControls makeDefault enablePan={false} minDistance={5} maxDistance={Math.max(14, distance * 1.3)} />
  );
}

export function App() {
  useKeyboardControls();
  useRecordSolves();
  useFeedback();
  useGuideTracker();
  useThemeSetting();
  const viewMoved = useUi((s) => s.viewMoved);
  const circularOpen = useUi((s) => s.circularOpen);
  const narrow = useMediaQuery(NARROW_SCREEN);

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
      {narrow && <StatusBlock />}
      {narrow && !circularOpen && <SessionCard />}
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
          {!narrow && <StatusBlock />}
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
