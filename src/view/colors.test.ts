import { describe, expect, it } from 'vitest'
import { COLORS } from '../cube/state.ts'
import {
  COLOR_LETTERS,
  contrastRatio,
  LETTER_INK,
  STICKER_COLORS,
} from './colors.ts'

describe('contrastRatio', () => {
  it('runs from 1 (the same colour) to 21 (black on white)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21)
    expect(contrastRatio('#0046ad', '#0046ad')).toBe(1)
  })

  it('matches published values', () => {
    // The guidelines' own example: #767676 on white is just over 4.5.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })
})

describe('colour letters', () => {
  it('gives every colour a different letter', () => {
    expect(new Set(COLORS.map((color) => COLOR_LETTERS[color])).size).toBe(6)
  })

  it.each(COLORS)('%s: the letter is easy to read on its sticker', (color) => {
    expect(
      contrastRatio(LETTER_INK[color], STICKER_COLORS[color]),
    ).toBeGreaterThanOrEqual(4.5)
  })
})
