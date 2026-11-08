import { describe, expect, it } from 'vitest'
import { COLORS, type Color } from '../cube/state.ts'
import { STICKER_COLORS } from '../view/colors.ts'
import {
  classifySides,
  colorDistance,
  matchCenters,
  nearestColor,
  PHOTO_COLORS,
} from './classify.ts'
import { rgbToLab, type Lab, type Rgb } from './colorSpace.ts'

/** The brand colours of the stickers, as the camera would give them. */
const BRAND = Object.fromEntries(
  COLORS.map((color) => {
    const hex = STICKER_COLORS[color]
    return [color, [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))]
  }),
) as unknown as Record<Color, Rgb>

/** Darker (a shadow) or brighter, by a factor. */
const shade = ([r, g, b]: Rgb, factor: number): Rgb =>
  [r, g, b].map((c) => Math.min(255, Math.round(c * factor))) as [
    number,
    number,
    number,
  ]

/** Under a warm light bulb: more red, much less blue. */
const warm = ([r, g, b]: Rgb): Rgb => [
  Math.min(255, Math.round(r * 1.15)),
  Math.round(g * 0.95),
  Math.round(b * 0.5),
]

const lab = (rgb: Rgb) => rgbToLab(rgb)

/** Six sides in the standard colour scheme, centre in the middle. */
const SCHEME: Color[] = ['white', 'red', 'green', 'yellow', 'orange', 'blue']

/**
 * Made-up sides: each centre in its own colour, the other 8 squares a mix
 * of colours, some in shadow and some brightly lit, as in a real photo.
 */
function photographSides(light: (rgb: Rgb) => Rgb = (rgb) => rgb) {
  const colors = SCHEME.map((center, side) =>
    Array.from({ length: 9 }, (_, n) =>
      n === 4 ? center : SCHEME[(side + n) % 6],
    ),
  )
  const readings = colors.map((side, s) =>
    side.map((color, n) =>
      lab(shade(light(BRAND[color]), [0.7, 0.85, 1, 1.15][(s + n) % 4])),
    ),
  )
  return { colors, readings }
}

describe('colorDistance', () => {
  it('is 0 for the same colour, and the same both ways', () => {
    const [red, orange] = [lab(BRAND.red), lab(BRAND.orange)]
    expect(colorDistance(red, red)).toBe(0)
    expect(colorDistance(red, orange)).toBeCloseTo(colorDistance(orange, red))
  })

  it('counts a shadow for less than a change of hue', () => {
    const red = lab(BRAND.red)
    expect(colorDistance(red, lab(shade(BRAND.red, 0.6)))).toBeLessThan(
      colorDistance(red, lab(BRAND.orange)),
    )
  })
})

describe('nearestColor', () => {
  it.each(COLORS)('names %s, in shadow and in bright light', (color) => {
    for (const factor of [0.5, 0.7, 1, 1.2]) {
      expect(nearestColor(lab(shade(BRAND[color], factor))), `×${factor}`).toBe(
        color,
      )
    }
  })

  it('compares with the references it is given', () => {
    const references = { ...PHOTO_COLORS, red: lab(BRAND.orange) }
    expect(nearestColor(lab(BRAND.orange), references)).toBe('red')
  })
})

describe('matchCenters', () => {
  it('names six centres, in any order', () => {
    const order: Color[] = ['blue', 'orange', 'white', 'green', 'red', 'yellow']
    expect(matchCenters(order.map((color) => lab(BRAND[color])))).toEqual(order)
  })

  it('never names two centres the same colour', () => {
    // Both look orange on their own, but the redder one must be red.
    const redOrange = lab([230, 80, 30])
    const orange = lab([240, 105, 25])
    expect(nearestColor(redOrange)).toBe('orange')
    expect(matchCenters([orange, redOrange])).toEqual(['orange', 'red'])
  })

  it('names a white centre with a logo on it white, once the others are taken', () => {
    const logo = lab([170, 60, 60]) // the logo's reddish print
    expect(nearestColor(logo)).toBe('red')
    const centers = SCHEME.map((color) =>
      color === 'white' ? logo : lab(BRAND[color]),
    )
    expect(matchCenters(centers)).toEqual(SCHEME)
  })

  it('names a single centre by its nearest colour', () => {
    expect(matchCenters([lab(BRAND.green)])).toEqual(['green'])
    expect(matchCenters([])).toEqual([])
  })

  it('refuses more than six', () => {
    expect(() => matchCenters(Array(7).fill(lab(BRAND.red)))).toThrow(
      'six sides',
    )
  })
})

describe('classifySides', () => {
  it('names every square in ordinary light', () => {
    const { colors, readings } = photographSides()
    expect(classifySides(readings)).toEqual(colors)
  })

  it("learns from the centres what the colours look like in the room's light", () => {
    const { colors, readings } = photographSides(warm)
    // Without the centres, warm light makes some squares look wrong…
    const alone = readings.map((side) =>
      side.map((square) => nearestColor(square)),
    )
    expect(alone).not.toEqual(colors)
    // …including the white and blue centres themselves: white looks most
    // like yellow, and blue like white. They still count, as their colour
    // comes second.
    expect(nearestColor(readings[0][4])).toBe('yellow')
    expect(nearestColor(readings[5][4])).toBe('white')
    // Compared with the centres, which are in the same light, they're right.
    expect(classifySides(readings)).toEqual(colors)
  })

  it('reads one side on its own', () => {
    const { colors, readings } = photographSides()
    expect(classifySides([readings[2]])).toEqual([colors[2]])
  })

  it("doesn't learn what white looks like from a logo", () => {
    const { colors, readings } = photographSides()
    // The white side's centre has a red logo on it, nearly the same red as
    // the red stickers. If that became white's reference, red squares
    // would be named white.
    const logo: Lab = lab([175, 30, 55])
    readings[0][4] = logo
    const named = classifySides(readings)
    expect(named[0][4]).toBe('white')
    expect(named).toEqual(colors)
  })
})
