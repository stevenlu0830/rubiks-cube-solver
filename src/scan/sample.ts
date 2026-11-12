/**
 * Reading the squares of one side from the camera: 9 on a 3x3, 4 on a 2x2.
 *
 * grabFrame copies the part of the camera's picture under the on-screen
 * guide into a small square of pixels. readSquares then works out one
 * colour for each square. It only needs plain numbers, so tests can make
 * up pictures without a camera.
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

/** How many pixels across a grabbed picture is: 40 for each square of a 3x3, 60 of a 2x2. */
export const GRAB_SIZE = 120

/**
 * Copies the part of the camera's picture under the guide, at GRAB_SIZE
 * pixels square. Null while the camera has no picture yet.
 *
 * `mirrored`: the picture is shown flipped left to right, as a laptop's
 * camera usually is. The pixels are still copied the camera's own way
 * round, which is how the side really looks; only which part of the
 * picture is under the guide changes.
 */
export function grabFrame(
  video: HTMLVideoElement,
  guide: Element,
  { mirrored = false }: { mirrored?: boolean } = {},
): Pixels | null {
  if (video.videoWidth === 0 || video.videoHeight === 0) return null
  const shown = video.getBoundingClientRect()
  const box = guide.getBoundingClientRect()
  const fromLeft = box.left - shown.left
  const area = shownPart(
    {
      x: mirrored ? shown.width - fromLeft - box.width : fromLeft,
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

/** One square of a picture: its colour, how much of it was glare, and how dark its edge is. */
export interface Square {
  color: Rgb
  /** The share of its pixels left out as glare, 0 to 1. */
  glare: number
  /**
   * How much darker the darkest part of its edge is than its middle, 0 to
   * 1. On a cube that's the black plastic (or the gap between pieces)
   * round each sticker, so it's high; on a wall or a table it's near 0.
   */
  edge: number
}

/**
 * Each square in a picture of one side with `size` squares along each edge
 * (3 for a 3x3, 2 for a 2x2), row by row from the top left: on a 3x3 the
 * centre is number 4.
 */
export function inspectSquares(pixels: Pixels, size = 3): Square[] {
  const squares: Square[] = []
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      squares.push(readSquare(pixels, column, row, size))
    }
  }
  return squares
}

/** Just the colour of each square, as inspectSquares. */
export function readSquares(pixels: Pixels, size = 3): Rgb[] {
  return inspectSquares(pixels, size).map(({ color }) => color)
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
  size: number,
): Square {
  const margin = (1 - MIDDLE) / 2
  const across = (n: number) => Math.round((n * width) / size)
  const down = (n: number) => Math.round((n * height) / size)
  const [left, right] = [across(column + margin), across(column + 1 - margin)]
  const [top, bottom] = [down(row + margin), down(row + 1 - margin)]
  const colors: Rgb[] = []
  /** How bright each pixel round the middle is: its brightest channel. */
  const edges: number[] = []
  for (let y = down(row); y < down(row + 1); y++) {
    for (let x = across(column); x < across(column + 1); x++) {
      const i = (y * width + x) * 4
      if (x >= left && x < right && y >= top && y < bottom) {
        colors.push([data[i], data[i + 1], data[i + 2]])
      } else {
        edges.push(Math.max(data[i], data[i + 1], data[i + 2]))
      }
    }
  }
  const kept = withoutGlare(colors)
  const color = median(kept)
  const middle = Math.max(...color)
  return {
    color,
    glare: (colors.length - kept.length) / colors.length,
    edge: middle > 0 ? Math.max(0, 1 - darkest(edges) / middle) : 0,
  }
}

/**
 * About how bright the darkest part of the edge is: a tenth of it is
 * darker. A few dark specks don't count, but a thin black line all round
 * does.
 */
function darkest(brightness: number[]): number {
  const sorted = [...brightness].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 10)] ?? 0
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
