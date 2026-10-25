import {
  CanvasTexture,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  type Material,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Cell, Color } from '../cube/state.ts'
import { STICKER_COLORS } from './colors.ts'
import { CUBIE_SIZE, STICKER_CORNER_RADIUS, STICKER_SIZE } from './layout.ts'

/**
 * The shapes and paints of the 3D cube. Every cubie shares one body shape and
 * every sticker shares one sticker shape and one paint per colour, so the
 * graphics card only has to know about a handful of objects.
 */

const UNPAINTED_COLOR = '#b9bdc6'
const UNPAINTED_MARK_COLOR = '#8a8f99'

export const BODY_GEOMETRY = new RoundedBoxGeometry(
  CUBIE_SIZE,
  CUBIE_SIZE,
  CUBIE_SIZE,
  3,
  0.07,
)
export const BODY_MATERIAL = new MeshStandardMaterial({
  color: '#141417',
  roughness: 0.6,
})

export const STICKER_GEOMETRY = roundedSquare(
  STICKER_SIZE,
  STICKER_CORNER_RADIUS,
)

const PAINTS = Object.fromEntries(
  Object.entries(STICKER_COLORS).map(([color, hex]) => [
    color,
    new MeshStandardMaterial({ color: hex, roughness: 0.45 }),
  ]),
) as Record<Color, MeshStandardMaterial>

// Created on first use: it draws on a <canvas>, which only exists in a browser.
let unpaintedMaterial: MeshStandardMaterial | undefined

export function stickerMaterial(cell: Cell): Material {
  if (cell !== null) return PAINTS[cell]
  unpaintedMaterial ??= new MeshStandardMaterial({
    map: questionMarkTexture(),
    roughness: 0.45,
  })
  return unpaintedMaterial
}

/**
 * Unpainted stickers are grey with a "?" so they can't be mistaken for
 * white ones, even in shadow.
 */
function questionMarkTexture(): CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = UNPAINTED_COLOR
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = UNPAINTED_MARK_COLOR
  ctx.font = `600 ${size * 0.55}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('?', size / 2, size * 0.54)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function roundedSquare(size: number, radius: number): ShapeGeometry {
  const h = size / 2
  const shape = new Shape()
  shape.moveTo(-h + radius, -h)
  shape.lineTo(h - radius, -h)
  shape.quadraticCurveTo(h, -h, h, -h + radius)
  shape.lineTo(h, h - radius)
  shape.quadraticCurveTo(h, h, h - radius, h)
  shape.lineTo(-h + radius, h)
  shape.quadraticCurveTo(-h, h, -h, h - radius)
  shape.lineTo(-h, -h + radius)
  shape.quadraticCurveTo(-h, -h, -h + radius, -h)
  const geometry = new ShapeGeometry(shape, 6)
  // ShapeGeometry uses raw x/y as texture coordinates; rescale them to 0–1
  // so the "?" texture covers the sticker exactly once.
  const uv = geometry.attributes.uv
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) / size + 0.5, uv.getY(i) / size + 0.5)
  }
  return geometry
}
