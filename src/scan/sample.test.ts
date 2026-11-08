import { afterEach, describe, expect, it, vi } from 'vitest'
import { seededRandom } from '../test/seededRandom.ts'
import type { Rgb } from './colorSpace.ts'
import { grabFrame, GRAB_SIZE, readSquares, type Pixels } from './sample.ts'

/** A made-up picture, coloured pixel by pixel. */
function picture(
  width: number,
  height: number,
  colorAt: (x: number, y: number) => Rgb,
): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set([...colorAt(x, y), 255], (y * width + x) * 4)
    }
  }
  return { data, width, height }
}

const NINE: Rgb[] = [
  [200, 30, 40],
  [240, 100, 30],
  [210, 200, 50],
  [20, 150, 80],
  [200, 200, 200],
  [20, 70, 160],
  [100, 10, 20],
  [120, 50, 15],
  [180, 180, 180],
]

/** Which of the 9 squares a pixel is in, and how far across and down it, 0 to 1. */
function whereIn(size: number, x: number, y: number) {
  const cell = size / 3
  const [column, row] = [Math.floor(x / cell), Math.floor(y / cell)]
  return {
    square: row * 3 + column,
    across: x / cell - column,
    down: y / cell - row,
  }
}

describe('readSquares', () => {
  it('reads each square, row by row from the top left', () => {
    const pixels = picture(120, 120, (x, y) => NINE[whereIn(120, x, y).square])
    expect(readSquares(pixels)).toEqual(NINE)
  })

  it('works when the size is not a multiple of 3', () => {
    const pixels = picture(100, 100, (x, y) => NINE[whereIn(100, x, y).square])
    expect(readSquares(pixels)).toEqual(NINE)
  })

  it('ignores the edges of each square: black plastic and neighbouring stickers', () => {
    const pixels = picture(120, 120, (x, y) => {
      const { square, across, down } = whereIn(120, x, y)
      const nearEdge = Math.min(across, down, 1 - across, 1 - down) < 0.22
      return nearEdge ? [0, 0, 0] : NINE[square]
    })
    expect(readSquares(pixels)).toEqual(NINE)
  })

  it('takes the middle value, so specks of dirt and noise make no difference', () => {
    const random = seededRandom(1)
    const pixels = picture(120, 120, (x, y) =>
      random() < 0.3
        ? [random() * 255, random() * 255, random() * 255]
        : NINE[whereIn(120, x, y).square],
    )
    expect(readSquares(pixels)).toEqual(NINE)
  })

  it('leaves out glare, even when it covers more than half the square', () => {
    const red: Rgb = [200, 30, 40]
    const pixels = picture(120, 120, (_, y) =>
      // The middle of the top row of squares is y = 10 to 29: glare covers
      // 12 of those 20 rows.
      y < 22 ? [250, 248, 245] : red,
    )
    expect(readSquares(pixels).slice(0, 3)).toEqual([red, red, red])
  })

  it('keeps a brightly lit white square that looks like glare all over', () => {
    const pixels = picture(120, 120, (x) =>
      x % 10 === 0 ? [225, 225, 225] : [245, 245, 245],
    )
    expect(readSquares(pixels)[4]).toEqual([245, 245, 245])
  })
})

describe('grabFrame', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const at = (left: number, top: number, width: number, height: number) => () =>
    ({ left, top, width, height }) as DOMRect

  /** A 1280×720 camera picture in a 360×640 box, with a 280 px guide in the middle. */
  function phoneHeldUpright() {
    const video = document.createElement('video')
    Object.defineProperty(video, 'videoWidth', { value: 1280 })
    Object.defineProperty(video, 'videoHeight', { value: 720 })
    video.getBoundingClientRect = at(16, 100, 360, 640)
    const guide = document.createElement('div')
    guide.getBoundingClientRect = at(16 + 40, 100 + 180, 280, 280)
    return { video, guide }
  }

  function fakeCanvas() {
    const pixels = picture(GRAB_SIZE, GRAB_SIZE, () => [1, 2, 3])
    const context = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => pixels),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    )
    return { context, pixels }
  }

  it('copies the part of the picture under the guide', () => {
    const { video, guide } = phoneHeldUpright()
    const { context, pixels } = fakeCanvas()

    expect(grabFrame(video, guide)).toBe(pixels)
    // The picture is scaled to 1137.8 × 640 to fill the box, so the 280 px
    // guide covers 315 of the camera's pixels, in the middle of its picture.
    expect(context.drawImage).toHaveBeenCalledWith(
      video,
      expect.closeTo(482.5),
      expect.closeTo(202.5),
      expect.closeTo(315),
      expect.closeTo(315),
      0,
      0,
      GRAB_SIZE,
      GRAB_SIZE,
    )
    expect(context.getImageData).toHaveBeenCalledWith(
      0,
      0,
      GRAB_SIZE,
      GRAB_SIZE,
    )
  })

  it('gives nothing until the camera has a picture', () => {
    const video = document.createElement('video')
    const { context } = fakeCanvas()
    expect(grabFrame(video, document.createElement('div'))).toBeNull()
    expect(context.drawImage).not.toHaveBeenCalled()
  })

  it('gives nothing if the browser has no canvas to draw on', () => {
    const { video, guide } = phoneHeldUpright()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(grabFrame(video, guide)).toBeNull()
  })
})
