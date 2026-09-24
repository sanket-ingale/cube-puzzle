import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { PerspectiveCamera } from 'three';
import { CircularPanel } from './circular/CircularPanel';
import { Cube } from './scene/Cube';
import { HelpDialog } from './ui/HelpDialog';
import { HistoryDialog } from './ui/HistoryDialog';
import { SettingsDialog } from './ui/SettingsDialog';
import { Celebration } from './ui/Celebration';
import { MovePad } from './ui/MovePad';
import { StatusCard } from './ui/StatusCard';
import { Brand, Toolbar } from './ui/Toolbar';
import { useUi } from './ui/uiStore';
import { NARROW_SCREEN, useMediaQuery } from './ui/useMediaQuery';
import { SCENE_COLOURS, useTheme, useThemeSetting } from './ui/theme';
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
const FILL_WIDE = 0.62;
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

function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const distance = useFitDistance();

  useEffect(() => {
    camera.position.setLength(distance);
  }, [camera, distance]);

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
  const theme = useTheme();
  const circularOpen = useUi((s) => s.circularOpen);
  const padOpen = useUi((s) => s.padOpen);

  const classes = ['app', circularOpen && 'with-2d', padOpen && 'with-pad'].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <main className="stage" aria-label="3D cube">
        <Canvas camera={{ position: [4.5, 4, 6], fov: FOV }} dpr={[1, 2]}>
          <color attach="background" args={[SCENE_COLOURS[theme].background]} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 8, 6]} intensity={1.6} />
          <directionalLight position={[-6, -4, -5]} intensity={0.5} />
          <Cube />
          <CameraRig />
        </Canvas>
      </main>
      {circularOpen && (
        <aside className="side">
          <CircularPanel />
        </aside>
      )}
      <div className="top">
        <Brand />
        <Toolbar />
      </div>
      <StatusCard />
      {padOpen && <MovePad />}
      <HelpDialog />
      <HistoryDialog />
      <SettingsDialog />
      <Celebration />
    </div>
  );
}
