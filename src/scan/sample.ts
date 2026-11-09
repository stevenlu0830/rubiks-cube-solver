/**
 * Reading the 9 squares of one side from the camera.
 *
 * grabFrame copies the part of the camera's picture under the on-screen
 * guide into a small square of pixels. readSquares then works out one
 * colour for each of the 9 squares. It only needs plain numbers, so tests
 * can make up pictures without a camera.
 */

import type { Rgb } from './colorSpace.ts'
import { shownPart } from './viewfinder.ts'

/**
 * Pixels as a canvas gives them: 4 numbers per pixel (red, green, blue, and
 * alpha, how see-through it is, which isn't used here), row by row from the
 * top left.
 */
export interface Pixels {
  readonly data: ArrayLike<number>
  readonly width: number
  readonly height: number
}

/** How many pixels across a grabbed picture is: 40 for each square. */
export const GRAB_SIZE = 120

/**
 * Copies the part of the camera's picture under the guide, at GRAB_SIZE
 * pixels square. Null while the camera has no picture yet.
 */
export function grabFrame(
  video: HTMLVideoElement,
  guide: Element,
): Pixels | null {
  if (video.videoWidth === 0 || video.videoHeight === 0) return null
  const shown = video.getBoundingClientRect()
  const box = guide.getBoundingClientRect()
  const area = shownPart(
    {
      x: box.left - shown.left,
      y: box.top - shown.top,
      width: box.width,
      height: box.height,
    },
    shown,
    { width: video.videoWidth, height: video.videoHeight },
  )
  const canvas = document.createElement('canvas')
  canvas.width = GRAB_SIZE
  canvas.height = GRAB_SIZE
  // willReadFrequently: keeps the pixels where reading them back is quick.
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(
    video,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    GRAB_SIZE,
    GRAB_SIZE,
  )
  return context.getImageData(0, 0, GRAB_SIZE, GRAB_SIZE)
}

/** One square of a picture: its colour, and how much of it was glare. */
export interface Square {
  color: Rgb
  /** The share of its pixels left out as glare, 0 to 1. */
  glare: number
}

/**
 * Each of the 9 squares in a picture of one side, row by row from the top
 * left (so the centre is number 4).
 */
export function inspectSquares(pixels: Pixels): Square[] {
  const squares: Square[] = []
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      squares.push(readSquare(pixels, column, row))
    }
  }
  return squares
}

/** Just the colour of each of the 9 squares, as inspectSquares. */
export function readSquares(pixels: Pixels): Rgb[] {
  return inspectSquares(pixels).map(({ color }) => color)
}

/**
 * How much of each square to read, across and down: the middle half. The
 * edges are often the black plastic between stickers, or part of the next
 * sticker when the cube isn't lined up exactly.
 */
const MIDDLE = 0.5

function readSquare(
  { data, width, height }: Pixels,
  column: number,
  row: number,
): Square {
  const edge = (1 - MIDDLE) / 2
  const left = Math.round(((column + edge) * width) / 3)
  const right = Math.round(((column + 1 - edge) * width) / 3)
  const top = Math.round(((row + edge) * height) / 3)
  const bottom = Math.round(((row + 1 - edge) * height) / 3)
  const colors: Rgb[] = []
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const i = (y * width + x) * 4
      colors.push([data[i], data[i + 1], data[i + 2]])
    }
  }
  const kept = withoutGlare(colors)
  return {
    color: median(kept),
    glare: (colors.length - kept.length) / colors.length,
  }
}

/**
 * Glare is a shiny patch where light bounces straight off the sticker into
 * the camera. It comes out nearly pure white (all three channels close to
 * full) whatever colour the sticker is.
 */
const GLARE = 235

/**
 * Leaves glare out. If that would leave less than a quarter of the square,
 * it's not glare: the sticker is white and brightly lit, so keep it all.
 */
function withoutGlare(colors: Rgb[]): Rgb[] {
  const rest = colors.filter((color) => Math.min(...color) < GLARE)
  return rest.length >= colors.length / 4 ? rest : colors
}

/**
 * The middle value of each channel. Unlike the average, a few odd pixels
 * (a speck of dirt, a reflection, a scratch) can't pull it off: they'd have
 * to be half the square.
 */
function median(colors: Rgb[]): Rgb {
  const middle = (channel: 0 | 1 | 2) => {
    const values = colors.map((color) => color[channel]).sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)]
  }
  return [middle(0), middle(1), middle(2)]
}
