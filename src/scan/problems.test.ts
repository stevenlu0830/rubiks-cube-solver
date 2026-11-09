import { describe, expect, it } from 'vitest'
import type { Color } from '../cube/state.ts'
import { rgbToLab, type Rgb } from './colorSpace.ts'
import { pictureProblem } from './problems.ts'

/** A look at a side where every square is this colour, with this much glare. */
function look(rgb: Rgb, glare = 0, named: Color = 'red') {
  return {
    squares: Array.from({ length: 9 }, () => ({ color: rgb, glare })),
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
