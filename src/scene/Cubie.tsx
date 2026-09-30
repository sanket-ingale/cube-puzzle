import { memo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color as ThreeColor } from 'three';
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLOR_HEX, COLOR_LETTER, paletteFor } from '../cube/colors';
import { usePrefs } from '../ui/prefs';
import { useUi } from '../ui/uiStore';
import { FLASH_MS } from '../keys/press';
import type { Color, Cubie as CubieModel, Vec3 } from '../cube/model';

const CUBIE_SIZE = 0.96;
const STICKER_SIZE = 0.8;
const STICKER_RADIUS = 0.1;
/** Sits the sticker just above the body surface to avoid z-fighting. */
const STICKER_OFFSET = CUBIE_SIZE / 2 + 0.002;

function roundedSquare(size: number, radius: number): ShapeGeometry {
  const h = size / 2;
  const shape = new Shape();
  shape.moveTo(-h + radius, -h);
  shape.lineTo(h - radius, -h);
  shape.quadraticCurveTo(h, -h, h, -h + radius);
  shape.lineTo(h, h - radius);
  shape.quadraticCurveTo(h, h, h - radius, h);
  shape.lineTo(-h + radius, h);
  shape.quadraticCurveTo(-h, h, -h, h - radius);
  shape.lineTo(-h, -h + radius);
  shape.quadraticCurveTo(-h, -h, -h + radius, -h);
  const geometry = new ShapeGeometry(shape, 6);
  // Shape UVs are raw coordinates; map them to 0–1 so a letter texture fills the sticker.
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + h) / size, (uv.getY(i) + h) / size);
  return geometry;
}

// Shared across all cubies, so re-rendering a cubie never rebuilds geometry mid-animation.
const bodyGeometry = new RoundedBoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE, 3, 0.08);
const stickerGeometry = roundedSquare(STICKER_SIZE, STICKER_RADIUS);
// Stickers are unlit and skip tone mapping, so every sticker shows its exact colour from any
// angle, with no highlights or shading shifting it (and it matches the 2D view). The plastic
// body stays lit and matte, which is what gives the cube its depth.
const stickerMaterials = Object.fromEntries(
  Object.entries(COLOR_HEX).map(([color, hex]) => [color, new MeshBasicMaterial({ color: hex, toneMapped: false })]),
) as Record<Color, MeshBasicMaterial>;
const bodyMaterial = new MeshStandardMaterial({ color: '#111114', roughness: 0.9, metalness: 0 });

// Learn mode lights up stickers with a glowing rim: pink for the piece to work on, light blue
// for the spot it goes to. Neither is a sticker colour, so they can't be mistaken for one.
const markGeometry = roundedSquare(0.94, 0.16);
const MARK_COLOURS = { piece: new ThreeColor('#ff3fd8'), target: new ThreeColor('#35e0ff') };
const markMaterials = {
  piece: new MeshBasicMaterial({ color: MARK_COLOURS.piece.clone(), toneMapped: false }),
  target: new MeshBasicMaterial({ color: MARK_COLOURS.target.clone(), toneMapped: false }),
};
const MARK_OF: Record<string, keyof typeof markMaterials> = { p: 'piece', t: 'target' };
const DIM = new ThreeColor('#111114');

/**
 * A pressed turn key's layer lights up for a moment (steadily while its key is hovered), as if
 * each sticker were a window with a light behind it:
 *
 * - the sticker brightens;
 * - soft shafts of light in its own colour pour out of it: a brighter core inside a wide, faint
 *   haze, both fading with distance, with faint moving streaks like light through uneven glass;
 * - the light spills onto the plastic around the sticker, as a coloured reflection.
 *
 * Shafts are brighter where they're seen edge-on, as a real beam of hazy air would be, so
 * looking straight into one doesn't wash the sticker out.
 */
const BEAM_LENGTH = 1.5;
const BEAM_SPREAD = 1.55;

/** The four sides of an open, widening shaft, from the sticker (z = 0) outwards. */
function beamGeometry(): BufferGeometry {
  const h = STICKER_SIZE / 2 - 0.03;
  const far = h * BEAM_SPREAD;
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const positions: number[] = [];
  const along: number[] = [];
  const across: number[] = [];
  const index: number[] = [];
  corners.forEach(([x0, y0], i) => {
    const [x1, y1] = corners[(i + 1) % 4];
    const base = positions.length / 3;
    positions.push(x0 * h, y0 * h, 0, x1 * h, y1 * h, 0, x0 * far, y0 * far, BEAM_LENGTH, x1 * far, y1 * far, BEAM_LENGTH);
    along.push(0, 0, 1, 1);
    across.push(0, 1, 0, 1);
    index.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('along', new Float32BufferAttribute(along, 1));
  geometry.setAttribute('across', new Float32BufferAttribute(across, 1));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
const beamGeo = beamGeometry();

// Shared by every beam, so one update animates them all.
const beamReach = { value: 0 };
const beamOpacity = { value: 0 };
const beamTime = { value: 0 };

function beamMaterial(hex: string, strength: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      color: { value: new ThreeColor(hex) },
      reach: beamReach,
      opacity: beamOpacity,
      time: beamTime,
      strength: { value: strength },
    },
    vertexShader: `
      attribute float along;
      attribute float across;
      uniform float reach;
      varying float vAlong;
      varying float vAcross;
      varying float vGrazing;
      void main() {
        vAlong = along;
        vAcross = across;
        vec3 p = position;
        p.z *= reach;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vGrazing = 1.0 - abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      uniform float time;
      uniform float strength;
      varying float vAlong;
      varying float vAcross;
      varying float vGrazing;
      void main() {
        // Fades gently with distance, and to nothing at the corners of the shaft.
        float falloff = pow(1.0 - vAlong, 2.6);
        float side = pow(sin(3.14159 * vAcross), 1.6);
        // Seen edge-on, a shaft looks through more haze, so it's brighter there.
        float haze = 0.25 + 0.75 * pow(vGrazing, 1.5);
        // Faint streaks drifting across, like light bent by uneven glass.
        float streaks = 0.82 + 0.18 * sin(vAcross * 21.0 + vAlong * 3.0 - time * 1.7) * sin(vAcross * 8.0 + time * 1.1);
        // Light scattered further out loses a little colour, going towards white.
        vec3 tint = mix(color, vec3(1.0), 0.18 * vAlong);
        gl_FragColor = vec4(tint, opacity * strength * falloff * side * haze * streaks);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
}
const coreMaterials = Object.fromEntries(
  Object.entries(COLOR_HEX).map(([color, hex]) => [color, beamMaterial(hex, 1)]),
) as Record<Color, ShaderMaterial>;
const hazeMaterials = Object.fromEntries(
  Object.entries(COLOR_HEX).map(([color, hex]) => [color, beamMaterial(hex, 0.45)]),
) as Record<Color, ShaderMaterial>;

/** A soft patch of light, brightest just outside the sticker, for the reflection on the plastic. */
function spillTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
const SPILL_SIZE = 1.0;
const spillGeometry = new PlaneGeometry(SPILL_SIZE, SPILL_SIZE);
let spillMap: CanvasTexture | null = null;
const spillMaterials = Object.fromEntries(
  Object.entries(COLOR_HEX).map(([color, hex]) => [
    color,
    new MeshBasicMaterial({ color: hex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  ]),
) as Record<Color, MeshBasicMaterial>;
function useSpillMap() {
  if (spillMap) return;
  spillMap = spillTexture();
  for (const m of Object.values(spillMaterials)) {
    m.map = spillMap;
    m.needsUpdate = true;
  }
}

const sheenMaterial = new MeshBasicMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});

/** Makes the lesson rims pulse gently and a pressed key's glow fade. Mounted once, by the cube. */
export function useMarkPulse() {
  useSpillMap();
  useFrame(({ clock }) => {
    const t = 0.55 + 0.45 * Math.sin(clock.elapsedTime * 4);
    for (const key of ['piece', 'target'] as const) markMaterials[key].color.copy(DIM).lerp(MARK_COLOURS[key], t);
    const flash = useUi.getState().flash;
    if (flash) {
      // The light shoots out quickly, holds through the first part of the turn, then fades.
      const t = (performance.now() - flash.at) / FLASH_MS;
      const fade = flash.hold ? 0.7 : t < 0.4 ? 1 : Math.max(0, 1 - (t - 0.4) / 0.6) ** 1.5;
      beamReach.value = flash.hold ? 1 : 1 - (1 - Math.min(1, t / 0.35)) ** 3;
      beamOpacity.value = 0.62 * fade;
      beamTime.value = clock.elapsedTime;
      sheenMaterial.opacity = 0.28 * fade;
      for (const m of Object.values(spillMaterials)) m.opacity = 0.6 * fade;
    }
  });
}

/**
 * A letter on white. The sticker material multiplies it by the sticker colour, so one texture
 * per letter works with any palette: white stays the sticker colour, the letter stays dark.
 */
const letterTextures = new Map<Color, CanvasTexture>();
function letterTexture(color: Color): CanvasTexture {
  let texture = letterTextures.get(color);
  if (texture) return texture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.font = '700 70px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(COLOR_LETTER[color], 64, 70);
  texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  letterTextures.set(color, texture);
  return texture;
}

/** Keeps the shared sticker materials in line with the colour and letter settings. */
export function useStickerAppearance() {
  const letters = usePrefs((s) => s.letters);
  const highContrast = usePrefs((s) => s.highContrast);
  useEffect(() => {
    const palette = paletteFor(highContrast);
    for (const [color, material] of Object.entries(stickerMaterials) as [Color, MeshBasicMaterial][]) {
      material.color.set(palette[color]);
      coreMaterials[color].uniforms.color.value.set(palette[color]);
      hazeMaterials[color].uniforms.color.value.set(palette[color]);
      spillMaterials[color].color.set(palette[color]);
      material.map = letters ? letterTexture(color) : null;
      material.needsUpdate = true;
    }
  }, [letters, highContrast]);
}

/** Rotation that turns a plane's default +z normal to face the given direction. */
function rotationFor([x, y, z]: Vec3): [number, number, number] {
  if (x !== 0) return [0, (x * Math.PI) / 2, 0];
  if (y !== 0) return [(-y * Math.PI) / 2, 0, 0];
  return [0, z > 0 ? 0 : Math.PI, 0];
}

/**
 * One cubie. `marks` lights up some of its stickers, one letter per sticker in order:
 * p for the piece being worked on, t for its target spot, w for a pressed key's layer,
 * anything else for none.
 */
export const Cubie = memo(function Cubie({ cubie, marks = '' }: { cubie: CubieModel; marks?: string }) {
  return (
    <group position={cubie.position as [number, number, number]}>
      <mesh geometry={bodyGeometry} material={bodyMaterial} />
      {cubie.stickers.map(({ normal, color }, i) => (
        <group key={color} position={normal.map((n) => n * STICKER_OFFSET) as [number, number, number]} rotation={rotationFor(normal)}>
          {MARK_OF[marks[i]] && (
            <mesh geometry={markGeometry} material={markMaterials[MARK_OF[marks[i]]]} position={[0, 0, -0.001]} />
          )}
          <mesh geometry={stickerGeometry} material={stickerMaterials[color]} />
          {marks[i] === 'w' && (
            <>
              <mesh geometry={spillGeometry} material={spillMaterials[color]} position={[0, 0, -0.0015]} renderOrder={2} />
              <mesh geometry={stickerGeometry} material={sheenMaterial} position={[0, 0, 0.001]} renderOrder={3} />
              <mesh geometry={beamGeo} material={coreMaterials[color]} position={[0, 0, 0.002]} renderOrder={4} />
              <mesh geometry={beamGeo} material={hazeMaterials[color]} position={[0, 0, 0.002]} scale={[1.35, 1.35, 1.35]} renderOrder={5} />
            </>
          )}
        </group>
      ))}
    </group>
  );
});
