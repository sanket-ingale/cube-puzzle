import { memo, useEffect } from 'react';
import { CanvasTexture, MeshStandardMaterial, Shape, ShapeGeometry, SRGBColorSpace } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLOR_HEX, COLOR_LETTER, paletteFor } from '../cube/colors';
import { usePrefs } from '../ui/prefs';
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
const stickerMaterials = Object.fromEntries(
  Object.entries(COLOR_HEX).map(([color, hex]) => [
    color,
    new MeshStandardMaterial({ color: hex, roughness: 0.35 }),
  ]),
) as Record<Color, MeshStandardMaterial>;
const bodyMaterial = new MeshStandardMaterial({ color: '#111114', roughness: 0.6 });

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
    for (const [color, material] of Object.entries(stickerMaterials) as [Color, MeshStandardMaterial][]) {
      material.color.set(palette[color]);
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

export const Cubie = memo(function Cubie({ cubie }: { cubie: CubieModel }) {
  return (
    <group position={cubie.position as [number, number, number]}>
      <mesh geometry={bodyGeometry} material={bodyMaterial} />
      {cubie.stickers.map(({ normal, color }) => (
        <mesh
          key={color}
          geometry={stickerGeometry}
          material={stickerMaterials[color]}
          position={normal.map((n) => n * STICKER_OFFSET) as [number, number, number]}
          rotation={rotationFor(normal)}
        />
      ))}
    </group>
  );
});
