import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ConeGeometry, MeshBasicMaterial, TorusGeometry } from 'three';
import { moveToTurn, type Move } from '../cube/moves';
import { SCENE_COLOURS, useTheme } from '../ui/theme';

/** Just outside the cube's corners (half-diagonal of a layer is about 2.12). */
const RING_RADIUS = 2.35;
/** The arrow sweeps three quarters of the way round, leaving a gap before its head. */
const ARC = Math.PI * 1.5;

const ringGeometry = new TorusGeometry(RING_RADIUS, 0.055, 8, 96, ARC);
const headGeometry = new ConeGeometry(0.2, 0.42, 20);
const material = new MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: 0.9 });

/** Rotations that stand the arrow's ring (made around +z) around each axis instead. */
const AXIS_ROTATION = {
  x: [0, Math.PI / 2, 0],
  y: [-Math.PI / 2, 0, 0],
  z: [0, 0, 0],
} as const;

/**
 * A curved arrow around the layer to turn, pointing the way it should go. It pulses gently so
 * it reads as a prompt rather than part of the cube.
 */
export function GuideArrow({ move }: { move: Move }) {
  const theme = useTheme();
  material.color.set(SCENE_COLOURS[theme].guide);
  const { axis, layer, quarterTurns } = moveToTurn(move);

  // The ring is drawn counter-clockwise around its own axis; mirror it for the other way.
  const direction = Math.sign(quarterTurns) || 1;
  const head = useMemo(() => {
    const angle = ARC;
    return {
      position: [RING_RADIUS * Math.cos(angle), RING_RADIUS * Math.sin(angle), 0] as const,
      // Cones point along +y; turn it to follow the ring's direction of travel at its end.
      rotation: [0, 0, angle] as const,
    };
  }, []);

  useFrame(({ clock }) => {
    material.opacity = 0.65 + 0.3 * Math.sin(clock.elapsedTime * 4);
  });

  const offset = [0, 0, 0] as [number, number, number];
  offset[{ x: 0, y: 1, z: 2 }[axis]] = layer;

  return (
    <group position={offset} rotation={[...AXIS_ROTATION[axis]]}>
      <group scale={[1, direction, 1]}>
        <mesh geometry={ringGeometry} material={material} />
        <mesh geometry={headGeometry} material={material} position={[...head.position]} rotation={[...head.rotation]} />
      </group>
    </group>
  );
}
