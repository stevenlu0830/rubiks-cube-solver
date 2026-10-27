import {
  CanvasTexture,
  Color as ThreeColor,
  MeshBasicMaterial,
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
/** Border round highlighted stickers: a pink no cube sticker uses. */
const HIGHLIGHT_COLOR = '#ff2fb3'
/** How bright the other stickers stay while some are highlighted. */
const DIM = 0.25

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

/** A slightly larger sticker shape behind a highlighted sticker, showing as a border. */
export const HIGHLIGHT_GEOMETRY = roundedSquare(
  STICKER_SIZE + 0.12,
  STICKER_CORNER_RADIUS + 0.06,
)
// Unlit, so the border is equally bright on every side of the cube.
export const HIGHLIGHT_MATERIAL = new MeshBasicMaterial({
  color: HIGHLIGHT_COLOR,
})

/**
 * Arrows showing which way the next turn goes: near-black with a white
 * outline, so they stand out on every sticker colour.
 */
export const ARROW_GEOMETRY = arrowShape(false, 0)
export const ARROW_OUTLINE_GEOMETRY = arrowShape(false, 0.07)
export const DOUBLE_ARROW_GEOMETRY = arrowShape(true, 0)
export const DOUBLE_ARROW_OUTLINE_GEOMETRY = arrowShape(true, 0.07)
export const ARROW_MATERIAL = new MeshBasicMaterial({ color: '#141417' })
export const ARROW_OUTLINE_MATERIAL = new MeshBasicMaterial({
  color: '#ffffff',
})

const paints = (brightness: number) =>
  Object.fromEntries(
    Object.entries(STICKER_COLORS).map(([color, hex]) => [
      color,
      new MeshStandardMaterial({
        color: new ThreeColor(hex).multiplyScalar(brightness),
        roughness: 0.45,
      }),
    ]),
  ) as Record<Color, MeshStandardMaterial>

const PAINTS = paints(1)
const DIMMED_PAINTS = paints(DIM)

// Created on first use: it draws on a <canvas>, which only exists in a browser.
let unpainted: { normal: Material; dimmed: Material } | undefined

/** The paint for a sticker; `dimmed` darkens it while other stickers are highlighted. */
export function stickerMaterial(cell: Cell, dimmed = false): Material {
  if (cell !== null) return (dimmed ? DIMMED_PAINTS : PAINTS)[cell]
  if (!unpainted) {
    const map = questionMarkTexture()
    unpainted = {
      normal: new MeshStandardMaterial({ map, roughness: 0.45 }),
      dimmed: new MeshStandardMaterial({
        map,
        roughness: 0.45,
        color: new ThreeColor(DIM, DIM, DIM),
      }),
    }
  }
  return dimmed ? unpainted.dimmed : unpainted.normal
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

/**
 * A flat arrow pointing along +x across a row of three stickers, with a head
 * at both ends if `doubleHeaded`. `border` grows it, for the outline.
 */
function arrowShape(doubleHeaded: boolean, border: number): ShapeGeometry {
  const halfLength = 1.25 + border
  const halfShaft = 0.1 + border
  const halfHead = 0.32 + border * 1.6
  const headLength = 0.5 + border * 1.6
  const tip = halfLength
  const neck = halfLength - headLength
  const tail = doubleHeaded ? -neck : -halfLength
  const shape = new Shape()
  shape.moveTo(tail, -halfShaft)
  shape.lineTo(neck, -halfShaft)
  shape.lineTo(neck, -halfHead)
  shape.lineTo(tip, 0)
  shape.lineTo(neck, halfHead)
  shape.lineTo(neck, halfShaft)
  shape.lineTo(tail, halfShaft)
  if (doubleHeaded) {
    shape.lineTo(tail, halfHead)
    shape.lineTo(-tip, 0)
    shape.lineTo(tail, -halfHead)
  }
  shape.closePath()
  return new ShapeGeometry(shape)
}
