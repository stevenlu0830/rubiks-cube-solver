import { describe, expect, it } from 'vitest'
import {
  dot,
  faceNormal,
  quarterTurnClockwise,
  STICKERS,
  stickerIndexAt,
} from './geometry.ts'
import { CENTER, cellIndex, FACES } from './state.ts'

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
