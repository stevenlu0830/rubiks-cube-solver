import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { STICKERS } from '../cube/geometry.ts'
import { CUBIE_SIZE, CUBIES } from './layout.ts'

const allStickers = CUBIES.flatMap((cubie) =>
  cubie.stickers.map((sticker) => ({ cubie, sticker })),
)

const expectClose = (actual: Vector3, expected: readonly number[]) => {
  actual.toArray().forEach((value, i) => expect(value).toBeCloseTo(expected[i]))
}

describe('CUBIES', () => {
  it('has 26 cubies at different positions, without the hidden centre one', () => {
    const positions = new Set(CUBIES.map((c) => c.position.join()))
    expect(CUBIES).toHaveLength(26)
    expect(positions.size).toBe(26)
    expect(positions.has('0,0,0')).toBe(false)
  })

  it('has 8 corners with 3 stickers, 12 edges with 2 and 6 centres with 1', () => {
    const counts = CUBIES.map((c) => c.stickers.length)
    expect(counts.filter((n) => n === 3)).toHaveLength(8)
    expect(counts.filter((n) => n === 2)).toHaveLength(12)
    expect(counts.filter((n) => n === 1)).toHaveLength(6)
  })

  it('places each of the 54 cells exactly once', () => {
    const cells = allStickers
      .map(({ sticker }) => sticker.cell)
      .sort((a, b) => a - b)
    expect(cells).toEqual(Array.from({ length: 54 }, (_, i) => i))
  })

  it('puts every sticker on the cubie of its cell, just above the plastic', () => {
    for (const { cubie, sticker } of allStickers) {
      const { position, normal } = STICKERS[sticker.cell]
      expect(cubie.position).toEqual(position)
      const offset = new Vector3(...sticker.offset)
      expect(offset.dot(new Vector3(...normal))).toBeGreaterThan(CUBIE_SIZE / 2)
      expect(offset.length()).toBeLessThan(CUBIE_SIZE / 2 + 0.01)
    }
  })

  it('turns every sticker to face outwards, upright as drawn in the net', () => {
    for (const { sticker } of allStickers) {
      const { normal, up } = STICKERS[sticker.cell]
      expectClose(
        new Vector3(0, 0, 1).applyQuaternion(sticker.quaternion),
        normal,
      )
      expectClose(new Vector3(0, 1, 0).applyQuaternion(sticker.quaternion), up)
    }
  })

  it('can spin every sticker in quarter turns about its own centre', () => {
    for (const { sticker } of allStickers) {
      const { normal, up } = STICKERS[sticker.cell]
      expect(sticker.spun[0]).toBe(sticker.quaternion)
      const right = new Vector3(...up).cross(new Vector3(...normal))
      const tops = [
        up,
        right.clone().negate().toArray(),
        up.map((v) => -v),
        right.toArray(),
      ]
      sticker.spun.forEach((spun, quarters) => {
        expectClose(new Vector3(0, 0, 1).applyQuaternion(spun), normal)
        expectClose(new Vector3(0, 1, 0).applyQuaternion(spun), tops[quarters])
      })
    }
  })
})
