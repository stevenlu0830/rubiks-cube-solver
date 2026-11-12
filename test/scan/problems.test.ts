import { describe, expect, it } from 'vitest'
import type { Color } from '../../src/cube/state.ts'
import { rgbToLab, type Rgb } from '../../src/scan/colorSpace.ts'
import { looksLikeSide, pictureProblem } from '../../src/scan/problems.ts'

/** A look at a side where every square is this colour, with this much glare. */
function look(rgb: Rgb, glare = 0, named: Color = 'red') {
  return {
    squares: Array.from({ length: 9 }, () => ({
      color: rgb,
      glare,
      edge: 0.8,
    })),
    readings: Array<ReturnType<typeof rgbToLab>>(9).fill(rgbToLab(rgb)),
    named: Array<Color>(9).fill(named),
  }
}

const check = (
  { squares, readings, named }: ReturnType<typeof look>,
  before: ReturnType<typeof look> | null = null,
) => pictureProblem(squares, readings, named, before?.readings ?? null)

describe('pictureProblem', () => {
  it('finds nothing wrong with a clear, still picture', () => {
    const red = look([183, 18, 52])
    expect(check(red, look([185, 20, 50]))).toBeNull()
  })

  it('says when the picture is too dark', () => {
    expect(check(look([25, 20, 22]))).toBe('dark')
  })

  it("doesn't call a blue side dark", () => {
    expect(check(look([0, 70, 173], 0, 'blue'))).toBeNull()
  })

  it('says when there is shine on a coloured sticker, but not on a white one', () => {
    expect(check(look([183, 18, 52], 0.3))).toBe('glare')
    expect(check(look([240, 240, 240], 0.3, 'white'))).toBeNull()
  })

  it('says when the picture changed a lot since the last look', () => {
    expect(check(look([183, 18, 52]), look([0, 155, 72]))).toBe('moving')
  })

  it('puts the worst problem first', () => {
    expect(check(look([25, 20, 22], 0.5), look([200, 200, 200]))).toBe('dark')
  })
})

describe('looksLikeSide', () => {
  const squares = (...edges: number[]) =>
    edges.map((edge) => ({ color: [183, 18, 52] as Rgb, glare: 0, edge }))

  it('sees a cube where the squares have dark edges', () => {
    expect(
      looksLikeSide(squares(0.9, 0.8, 0.9, 0.7, 0.9, 0.8, 0.9, 0.9, 0.8)),
    ).toBe(true)
  })

  it('allows a couple of squares without, for a cube not quite lined up', () => {
    expect(
      looksLikeSide(squares(0.9, 0.8, 0.9, 0.7, 0, 0.8, 0.9, 0.9, 0.1)),
    ).toBe(true)
    expect(
      looksLikeSide(squares(0.9, 0.8, 0.9, 0.1, 0, 0.8, 0.9, 0.9, 0.1)),
    ).toBe(false)
  })

  it("needs 3 of a 2x2's 4 squares to look like stickers", () => {
    expect(looksLikeSide(squares(0.9, 0.8, 0.9, 0.7))).toBe(true)
    expect(looksLikeSide(squares(0.9, 0.8, 0.1, 0.7))).toBe(true)
    expect(looksLikeSide(squares(0.9, 0, 0.1, 0.7))).toBe(false)
  })

  it("doesn't see a cube in a wall or a table", () => {
    expect(looksLikeSide(squares(...Array<number>(9).fill(0.05)))).toBe(false)
  })
})
