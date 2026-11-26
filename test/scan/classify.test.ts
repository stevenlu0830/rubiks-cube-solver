import { describe, expect, it } from 'vitest'
import { applyMoves, randomScramble } from '../../src/cube/moves.ts'
import { PUZZLE_2X2, PUZZLE_4X4, PUZZLE_5X5 } from '../../src/cube/puzzle.ts'
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
import {
  randomTurns as randomFiveByFive,
  SOLVED_5X5,
} from '../helpers/fiveByFive.ts'
import { randomTurns } from '../helpers/fourByFour.ts'
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

describe('classifySides on a 4x4', () => {
  const random = seededRandom(44)
  const SOLVED_4X4 = solvedState(STANDARD_SCHEME, PUZZLE_4X4)
  const scrambled = () => applyMoves(SOLVED_4X4, randomTurns(50, random))

  /** Dim light: everything much darker, blue a little less so. */
  const dim = ([r, g, b]: Rgb): Rgb => [
    Math.round(r * 0.45),
    Math.round(g * 0.45),
    Math.round(b * 0.5),
  ]

  /** A 4x4's six sides photographed, 16 squares each, some in shadow and some brightly lit. */
  function photographFourByFour(
    cube: CubeState,
    light: (rgb: Rgb) => Rgb = (rgb) => rgb,
  ) {
    const colors = FACES.map((face) =>
      Array.from(
        { length: 16 },
        (_, n) => cube[cellIndex(face, n, PUZZLE_4X4)]!,
      ),
    )
    const readings = colors.map((side, s) =>
      side.map((color, n) =>
        lab(shade(light(BRAND[color]), [0.7, 0.85, 1, 1.15][(s + n) % 4])),
      ),
    )
    return { colors, readings }
  }

  it('names every square in ordinary light, with no fixed centres to go by', () => {
    for (let run = 0; run < 10; run++) {
      const { colors, readings } = photographFourByFour(scrambled())
      expect(classifySides(readings)).toEqual(colors)
    }
  })

  it('gives no colour more than 16 squares', () => {
    const red = lab(BRAND.red)
    const named = classifySides([Array(16).fill(red), Array(16).fill(red)])
    expect(named.flat().filter((color) => color === 'red')).toHaveLength(16)
  })

  it('learns what the colours look like from its very first side', () => {
    // 16 squares are enough to learn from: in dim light, typical photo
    // colours alone get far more of the first side wrong.
    let wrongAlone = 0
    let wrongLearned = 0
    for (let run = 0; run < 20; run++) {
      const { colors, readings } = photographFourByFour(scrambled(), dim)
      wrongAlone += readings[0].filter(
        (square, n) => nearestColor(square) !== colors[0][n],
      ).length
      wrongLearned += classifySides([readings[0]])[0].filter(
        (color, n) => color !== colors[0][n],
      ).length
      // With all six in, every square is right.
      expect(classifySides(readings)).toEqual(colors)
    }
    expect(wrongLearned).toBeLessThan(0.75 * wrongAlone)
  })

  it('names nearly every square right in warm light, once all six sides are in', () => {
    // Warm light makes about a third of the squares look like another
    // colour on their own. Learning from the squares puts all but 1 in 40
    // right, and most cubes entirely; the check before solving settles
    // many of the rest (see closeCalls.ts).
    let wrongAlone = 0
    let wrongNamed = 0
    let cubesRight = 0
    const runs = 20
    for (let run = 0; run < runs; run++) {
      const { colors, readings } = photographFourByFour(scrambled(), warm)
      wrongAlone += readings
        .flat()
        .filter((square, i) => nearestColor(square) !== colors.flat()[i]).length
      const named = classifySides(readings).flat()
      const wrong = named.filter((color, i) => color !== colors.flat()[i])
      wrongNamed += wrong.length
      if (wrong.length === 0) cubesRight++
    }
    expect(wrongAlone / (runs * 96)).toBeGreaterThan(0.25)
    expect(wrongNamed / (runs * 96)).toBeLessThan(0.03)
    expect(cubesRight).toBeGreaterThanOrEqual(0.75 * runs)
  })
})

describe('classifySides on a 5x5', () => {
  const random = seededRandom(55)
  const scrambled = () => applyMoves(SOLVED_5X5, randomFiveByFive(60, random))

  /** Dim light: everything much darker, blue a little less so. */
  const dim = ([r, g, b]: Rgb): Rgb => [
    Math.round(r * 0.45),
    Math.round(g * 0.45),
    Math.round(b * 0.5),
  ]
  /** Daylight from a window, or a cool white bulb: less red, more blue. */
  const cool = ([r, g, b]: Rgb): Rgb => [
    Math.round(r * 0.8),
    Math.round(g * 0.95),
    Math.min(255, Math.round(b * 1.2)),
  ]

  /**
   * A 5x5's six sides photographed, 25 squares each, each square anywhere
   * from in shadow to brightly lit, centres too.
   */
  function photographFiveByFive(
    cube: CubeState,
    light: (rgb: Rgb) => Rgb = (rgb) => rgb,
  ) {
    const colors = FACES.map((face) =>
      Array.from(
        { length: 25 },
        (_, n) => cube[cellIndex(face, n, PUZZLE_5X5)]!,
      ),
    )
    const readings = colors.map((side) =>
      side.map((color) =>
        lab(shade(light(BRAND[color]), 0.7 + 0.45 * random())),
      ),
    )
    return { colors, readings }
  }

  /** How many squares are named wrong. */
  const wrongIn = (named: Color[][], colors: Color[][]) =>
    named.flat().filter((color, i) => color !== colors.flat()[i]).length

  it.each([
    ['ordinary', (rgb: Rgb) => rgb],
    ['cool', cool],
  ])(
    'names every square in %s light, each centre a different colour',
    (_, light) => {
      for (let run = 0; run < 10; run++) {
        const { colors, readings } = photographFiveByFive(scrambled(), light)
        const named = classifySides(readings)
        expect(named).toEqual(colors)
        expect(new Set(named.map((side) => side[12])).size).toBe(6)
      }
    },
  )

  it('gives no colour more than 25 squares, and no two sides the same centre', () => {
    const red = lab(BRAND.red)
    const named = classifySides([Array(25).fill(red), Array(25).fill(red)])
    expect(named.flat().filter((color) => color === 'red')).toHaveLength(25)
    expect(named[0][12]).not.toBe(named[1][12])
  })

  it('keeps a centre picked by hand, and gives its colour to no other centre', () => {
    const { colors, readings } = photographFiveByFive(SOLVED_5X5)
    const fixed = colors.map(() => Array<Color | null>(25).fill(null))
    fixed[0][12] = 'green' // the white side's centre
    const named = classifySides(readings, { fixed })
    expect(named[0][12]).toBe('green')
    expect(named.filter((side) => side[12] === 'green')).toHaveLength(1)
  })

  it("outlines a centre that doesn't look like its colour, such as a logo", () => {
    const { readings } = photographFiveByFive(SOLVED_5X5)
    readings[0][12] = lab([90, 110, 140]) // a grey-blue logo on the white centre
    const centre = classifyWithDoubts(readings)[0][12]
    expect(centre).toEqual({ color: 'white', unsure: true })
  })

  it('names the centres by the colours it learns, which warm light can fool', () => {
    // A white centre in full warm light and a yellow one in shadow look
    // more like each other's typical photo colours. The other 24 white
    // squares, and 24 yellow, show what each really looks like here.
    const { colors, readings } = photographFiveByFive(scrambled(), warm)
    readings[0][12] = lab(shade(warm(BRAND.white), 1))
    readings[3][12] = lab(shade(warm(BRAND.yellow), 0.7))
    const centres = matchCenters(readings.map((side) => side[12]))
    expect([centres[0], centres[3]]).toEqual(['yellow', 'white'])
    const named = classifySides(readings)
    expect([named[0][12], named[3][12]]).toEqual(['white', 'yellow'])
    expect(named).toEqual(colors)
  })

  it('learns what the colours look like from its very first side', () => {
    // In dim light, typical photo colours alone get far more of the first
    // side wrong: its 25 squares give 3 or 4 of each colour to learn from.
    let wrongAlone = 0
    let wrongLearned = 0
    for (let run = 0; run < 20; run++) {
      const { colors, readings } = photographFiveByFive(scrambled(), dim)
      wrongAlone += readings[0].filter(
        (square, n) => nearestColor(square) !== colors[0][n],
      ).length
      wrongLearned += wrongIn(classifySides([readings[0]]), [colors[0]])
      // With all six in, every square is right.
      expect(classifySides(readings)).toEqual(colors)
    }
    expect(wrongLearned).toBeLessThan(0.75 * wrongAlone)
  })

  it('names nearly every square right in warm light, once all six sides are in', () => {
    // Warm light makes about a third of the squares look like another
    // colour on their own, and one centre of each colour, perhaps in
    // shadow, is a poor guide. Learning from all 150 squares puts nearly
    // every one right.
    let wrongAlone = 0
    let wrongNamed = 0
    let cubesRight = 0
    const runs = 20
    for (let run = 0; run < runs; run++) {
      const { colors, readings } = photographFiveByFive(scrambled(), warm)
      wrongAlone += readings
        .flat()
        .filter((square, i) => nearestColor(square) !== colors.flat()[i]).length
      const wrong = wrongIn(classifySides(readings), colors)
      wrongNamed += wrong
      if (wrong === 0) cubesRight++
    }
    expect(wrongAlone / (runs * 150)).toBeGreaterThan(0.25)
    expect(wrongNamed / (runs * 150)).toBeLessThan(0.01)
    expect(cubesRight).toBeGreaterThanOrEqual(0.8 * runs)
  })
})
