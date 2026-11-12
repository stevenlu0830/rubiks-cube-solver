import { describe, expect, it } from 'vitest'
import { applyMoves, randomScramble } from '../../src/cube/moves.ts'
import { PUZZLE_2X2 } from '../../src/cube/puzzle.ts'
import {
  cellIndex,
  COLORS,
  FACES,
  solvedState,
  STANDARD_SCHEME,
  type Color,
  type CubeState,
} from '../../src/cube/state.ts'
import { STICKER_COLORS } from '../../src/view/colors.ts'
import { seededRandom } from '../helpers/seededRandom.ts'
import {
  classifySides as classifyWithDoubts,
  colorDistance,
  matchCenters,
  nearestColor,
  PHOTO_COLORS,
} from '../../src/scan/classify.ts'
import { rgbToLab, type Lab, type Rgb } from '../../src/scan/colorSpace.ts'

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

/** Just the colours classifySides names, without whether it was sure. */
const classifySides = (
  ...args: Parameters<typeof classifyWithDoubts>
): Color[][] =>
  classifyWithDoubts(...args).map((side) => side.map(({ color }) => color))

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

  /** Two orange squares that, on their own, look more red than orange. */
  function twoRedLookingOranges() {
    const { colors, readings } = photographSides()
    const oranges = colors
      .flatMap((side, s) => side.map((color, n) => ({ color, s, n })))
      .filter(({ color, n }) => color === 'orange' && n !== 4)
      .slice(0, 2)
    for (const { s, n } of oranges) readings[s][n] = lab([205, 45, 45])
    return { colors, readings, oranges }
  }

  it('gives no colour more than 9 squares: the least red of 11 "reds" are orange', () => {
    const { colors, readings, oranges } = twoRedLookingOranges()
    // Even compared with the centres, which are in the same light, each of
    // the two is nearer the red centre than the orange one.
    for (const { s, n } of oranges) {
      const references = {
        ...PHOTO_COLORS,
        red: readings[1][4],
        orange: readings[4][4],
      }
      expect(nearestColor(readings[s][n], references)).toBe('red')
    }
    const read = classifyWithDoubts(readings)
    expect(read.map((side) => side.map(({ color }) => color))).toEqual(colors)
    for (const { s, n } of oranges) expect(read[s][n].unsure).toBe(true)
  })

  it('keeps to 9 of a colour with only some sides scanned', () => {
    // Two sides where every square looks red: only 9 can be.
    const red = lab(BRAND.red)
    const named = classifySides([Array(9).fill(red), Array(9).fill(red)])
    expect(named.flat().filter((color) => color === 'red')).toHaveLength(9)
  })

  it('keeps colours picked by hand, and counts them towards the 9', () => {
    const { colors, readings, oranges } = twoRedLookingOranges()
    // The user says the first one is red after all (a white square, say,
    // that they've picked red): it stays red, so one fewer red is left
    // for the rest.
    const [first, second] = oranges
    const fixed = colors.map((side) => side.map(() => null as Color | null))
    fixed[first.s][first.n] = 'red'
    const read = classifyWithDoubts(readings, { fixed })
    expect(read[first.s][first.n]).toEqual({ color: 'red', unsure: false })
    expect(read[second.s][second.n].color).toBe('orange')
    const reds = read.flat().filter(({ color }) => color === 'red')
    expect(reds).toHaveLength(9)
  })

  it('keeps a centre picked by hand, and gives its colour to no other centre', () => {
    const { readings } = photographSides()
    const fixed = readings.map(() => Array<Color | null>(9).fill(null))
    fixed[1][4] = 'orange' // the red side's centre, picked orange by mistake
    const read = classifyWithDoubts(readings, { fixed })
    expect(read[1][4].color).toBe('orange')
    expect(read[4][4].color).not.toBe('orange') // the real orange centre
  })

  it('is sure of clear colours, and unsure of close calls', () => {
    const between = lab([220, 65, 35]) // about as red as it is orange
    const read = classifyWithDoubts([
      [
        ...Array(4).fill(lab(BRAND.green)),
        lab(BRAND.green),
        between,
        ...Array(3).fill(lab(BRAND.green)),
      ],
    ])
    expect(read[0][0]).toMatchObject({ color: 'green', unsure: false })
    expect(read[0][5].unsure).toBe(true)
  })
})

describe('classifySides on a 2x2', () => {
  const random = seededRandom(22)
  const SOLVED_2X2 = solvedState(STANDARD_SCHEME, PUZZLE_2X2)
  const scrambled = () => applyMoves(SOLVED_2X2, randomScramble(25, random))

  /**
   * A 2x2's six sides photographed, 4 squares each in photo order, some in
   * shadow and some brightly lit, as in a real photo.
   */
  function photographTwoByTwo(
    cube: CubeState,
    light: (rgb: Rgb) => Rgb = (rgb) => rgb,
  ) {
    const colors = FACES.map((face) =>
      [0, 1, 2, 3].map((n) => cube[cellIndex(face, n, PUZZLE_2X2)]!),
    )
    const readings = colors.map((side, s) =>
      side.map((color, n) =>
        lab(shade(light(BRAND[color]), [0.7, 0.85, 1, 1.15][(s + n) % 4])),
      ),
    )
    return { colors, readings }
  }

  it('names every square in ordinary light, with no centres to go by', () => {
    for (let run = 0; run < 10; run++) {
      const { colors, readings } = photographTwoByTwo(scrambled())
      expect(classifySides(readings)).toEqual(colors)
    }
  })

  it('reads one side on its own', () => {
    const { colors, readings } = photographTwoByTwo(scrambled())
    expect(classifySides([readings[2]])).toEqual([colors[2]])
  })

  it('gives no colour more than 4 squares', () => {
    const red = lab(BRAND.red)
    const named = classifySides([Array(4).fill(red), Array(4).fill(red)])
    expect(named.flat().filter((color) => color === 'red')).toHaveLength(4)
  })

  it("learns what the colours look like in the room's light from the squares themselves", () => {
    // Warm light makes a third of the squares look like another colour on
    // their own. Learning each colour from the squares that got it puts
    // nearly every cube right; typical photo colours alone get about half.
    let squaresWrongAlone = 0
    let cubesRight = 0
    const runs = 20
    for (let run = 0; run < runs; run++) {
      const { colors, readings } = photographTwoByTwo(scrambled(), warm)
      squaresWrongAlone += readings
        .flat()
        .filter((square, i) => nearestColor(square) !== colors.flat()[i]).length
      if (JSON.stringify(classifySides(readings)) === JSON.stringify(colors)) {
        cubesRight++
      }
    }
    expect(squaresWrongAlone / (runs * 24)).toBeGreaterThan(0.25)
    expect(cubesRight).toBeGreaterThanOrEqual(0.85 * runs)
  })

  it('keeps colours picked by hand, and counts them towards the 4', () => {
    const { colors, readings } = photographTwoByTwo(scrambled())
    const fixed = colors.map(() => Array<Color | null>(4).fill(null))
    // A green square the user has picked as red: it stays red, so one fewer
    // red is left for the rest.
    const s = colors.findIndex((side) => side.includes('green'))
    const n = colors[s].indexOf('green')
    fixed[s][n] = 'red'
    const read = classifyWithDoubts(readings, { fixed })
    expect(read[s][n]).toEqual({ color: 'red', unsure: false })
    expect(read.flat().filter(({ color }) => color === 'red')).toHaveLength(4)
  })

  it('says what an unsure square might be instead, and how much worse that fits', () => {
    const { readings } = photographTwoByTwo(SOLVED_2X2)
    const between = lab([220, 65, 35]) // about as red as it is orange
    readings[1][0] = between // a square of the red side
    const read = classifyWithDoubts(readings)[1][0]
    expect(read.unsure).toBe(true)
    expect([read.color, read.secondChoice!.color].sort()).toEqual([
      'orange',
      'red',
    ])
    expect(Math.abs(read.secondChoice!.cost)).toBeLessThan(20)
    // A clear square's second choice fits far worse.
    const clear = classifyWithDoubts(readings)[2][0]
    expect(clear.unsure).toBe(false)
    expect(clear.secondChoice!.cost).toBeGreaterThan(20)
  })
})
