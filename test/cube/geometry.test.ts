import { describe, expect, it } from 'vitest'
import {
  dot,
  faceNormal,
  outerLayer,
  quarterTurnClockwise,
  snapToGrid,
  STICKERS,
  stickerIndexAt,
  stickersOf,
} from '../../src/cube/geometry.ts'
import { PUZZLE_2X2, PUZZLE_3X3 } from '../../src/cube/puzzle.ts'
import { CENTER, cellIndex, FACES } from '../../src/cube/state.ts'

describe('STICKERS', () => {
  it('places 54 stickers at 54 different spots', () => {
    const spots = new Set(
      STICKERS.map(({ position, normal }) => `${position}|${normal}`),
    )
    expect(STICKERS).toHaveLength(54)
    expect(spots.size).toBe(54)
  })

  it('puts every sticker on the outside of its face', () => {
    for (const { position, normal } of STICKERS) {
      expect(dot(position, normal)).toBe(1)
    }
  })

  it('puts each face centre in the middle of that face', () => {
    for (const face of FACES) {
      expect(STICKERS[cellIndex(face, CENTER)].position).toEqual(
        faceNormal(face),
      )
    }
  })

  it('matches the net: U0 is the back-left corner of the top face', () => {
    expect(STICKERS[cellIndex('U', 0)].position).toEqual([-1, 1, -1])
    expect(STICKERS[cellIndex('F', 0)].position).toEqual([-1, 1, 1])
    expect(STICKERS[cellIndex('D', 0)].position).toEqual([-1, -1, 1])
  })

  it('can be looked up by position and normal', () => {
    STICKERS.forEach(({ position, normal }, i) => {
      expect(stickerIndexAt(position, normal)).toBe(i)
    })
  })
})

describe('quarterTurnClockwise', () => {
  it('turns front to left around the up axis, like a U move', () => {
    expect(quarterTurnClockwise([0, 0, 1], [0, 1, 0])).toEqual([-1, 0, 0])
  })

  it('turns front to up around the right axis, like an R move', () => {
    expect(quarterTurnClockwise([0, 0, 1], [1, 0, 0])).toEqual([0, 1, 0])
  })

  it('turns up to right around the front axis, like an F move', () => {
    expect(quarterTurnClockwise([0, 1, 0], [0, 0, 1])).toEqual([1, 0, 0])
  })
})

describe('stickersOf a 2x2', () => {
  const stickers = stickersOf(PUZZLE_2X2)

  it('places 24 stickers at 24 different spots', () => {
    const spots = new Set(
      stickers.map(({ position, normal }) => `${position}|${normal}`),
    )
    expect(stickers).toHaveLength(24)
    expect(spots.size).toBe(24)
  })

  it('puts every sticker on a corner cubie, half a step out from the middle each way', () => {
    for (const { position, normal } of stickers) {
      expect(dot(position, normal)).toBe(0.5)
      for (const coordinate of position) {
        expect(Math.abs(coordinate)).toBe(0.5)
      }
    }
    const cubies = new Set(stickers.map(({ position }) => `${position}`))
    expect(cubies.size).toBe(8)
  })

  it('reads each face left to right, top to bottom, as in the net', () => {
    const at = (face: 'U' | 'F', n: number) =>
      stickers[cellIndex(face, n, PUZZLE_2X2)].position
    expect(at('U', 0)).toEqual([-0.5, 0.5, -0.5]) // top: back left
    expect(at('U', 3)).toEqual([0.5, 0.5, 0.5]) // top: front right
    expect(at('F', 0)).toEqual([-0.5, 0.5, 0.5]) // front: top left
    expect(at('F', 1)).toEqual([0.5, 0.5, 0.5]) // front: top right
    expect(at('F', 2)).toEqual([-0.5, -0.5, 0.5]) // front: bottom left
  })

  it('finds every sticker again from where it is', () => {
    stickers.forEach(({ position, normal }, cell) => {
      expect(stickerIndexAt(position, normal, PUZZLE_2X2)).toBe(cell)
    })
  })

  it('keeps the 3x3 as it was', () => {
    expect(stickersOf(PUZZLE_3X3)).toBe(STICKERS)
  })
})

describe('outerLayer', () => {
  it('is 1 out from the middle on a 3x3, and 0.5 on a 2x2', () => {
    expect(outerLayer(PUZZLE_3X3)).toBe(1)
    expect(outerLayer(PUZZLE_2X2)).toBe(0.5)
  })
})

describe('snapToGrid', () => {
  it('rounds to the nearest half, for both cubes', () => {
    expect(snapToGrid([0.4999999, -0.5000001, 1.0000002])).toEqual([
      0.5, -0.5, 1,
    ])
    expect(snapToGrid([0.0000001, 0.9999999, -1.0000001])).toEqual([0, 1, -1])
  })
})
