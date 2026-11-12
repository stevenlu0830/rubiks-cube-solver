/**
 * Naming the colour of each square the camera read.
 *
 * Each reading is compared with a reference for every colour (what that
 * colour looks like in a photo), and takes the name of the nearest one. The
 * references start as typical photo colours, then are learned from the
 * photos: each side's centre square on a 3x3, the squares themselves on a
 * 2x2. Your own cube, in your own light, is the best guide to what its
 * colours look like.
 */

import { puzzleOfSide } from '../cube/puzzle.ts'
import { CENTER, COLORS, type Color } from '../cube/state.ts'
import { cheapestAssignment } from './assign.ts'
import { chroma, rgbToLab, type Lab } from './colorSpace.ts'

/** What each colour looks like: the readings to compare with. */
export type References = Readonly<Record<Color, Lab>>

/**
 * Where to start: about what each sticker colour looks like in a phone
 * photo. That's duller and darker than the brand colours (in
 * src/view/colors.ts): a photo of white is light grey, for example.
 */
export const PHOTO_COLORS: References = {
  white: rgbToLab([200, 200, 200]),
  yellow: rgbToLab([215, 205, 45]),
  green: rgbToLab([20, 150, 80]),
  blue: rgbToLab([20, 70, 165]),
  red: rgbToLab([175, 25, 40]),
  orange: rgbToLab([235, 100, 25]),
}

// How much each kind of difference counts. Hue (red, green, blue…) counts
// most. How vivid and how bright a colour is count for less, because a
// shadow or dim light changes both without changing the sticker's colour.
const HUE = 1
const VIVIDNESS = 0.5
const BRIGHTNESS = 0.5

/** How different two colours are, mostly by hue. 0 means the same. */
export function colorDistance(x: Lab, y: Lab): number {
  const brightness = x.l - y.l
  const vividness = chroma(x) - chroma(y)
  // Whatever difference across the colour wheel (a, b) isn't explained by
  // vividness is a difference in hue.
  const hueSquared = Math.max(
    0,
    (x.a - y.a) ** 2 + (x.b - y.b) ** 2 - vividness ** 2,
  )
  return Math.sqrt(
    (BRIGHTNESS * brightness) ** 2 +
      (VIVIDNESS * vividness) ** 2 +
      HUE ** 2 * hueSquared,
  )
}

/** The colour whose reference is nearest to this reading. */
export function nearestColor(
  reading: Lab,
  references: References = PHOTO_COLORS,
): Color {
  return byDistance(reading, references)[0]
}

/**
 * Names the centres of the sides scanned so far. Every side of a cube has a
 * different centre colour, so rather than naming each centre on its own,
 * this tries every way of giving them different colours, and keeps the one
 * that fits best overall. With six sides that's 720 ways: quick to try.
 *
 * That gets past centres that are hard to read on their own, like the white
 * one with a logo printed on it: once the other five colours are taken,
 * white is the only one left.
 *
 * `pinned` gives the colour of any centre the user has picked by hand: it
 * keeps that colour, and no other centre gets it.
 */
export function matchCenters(
  centers: readonly Lab[],
  references: References = PHOTO_COLORS,
  pinned: readonly (Color | null)[] = [],
): Color[] {
  if (centers.length > COLORS.length) {
    throw new RangeError('A cube only has six sides')
  }
  const taken = new Set(pinned.filter((color) => color !== null))
  let best: Color[] = []
  let bestTotal = Infinity
  const tryAll = (chosen: Color[], total: number) => {
    if (total >= bestTotal) return // already worse than the best: stop here
    if (chosen.length === centers.length) {
      best = chosen
      bestTotal = total
      return
    }
    const center = centers[chosen.length]
    const pin = pinned[chosen.length]
    if (pin) {
      tryAll([...chosen, pin], total)
      return
    }
    for (const color of COLORS) {
      if (chosen.includes(color) || taken.has(color)) continue
      tryAll(
        [...chosen, color],
        total + colorDistance(center, references[color]),
      )
    }
  }
  tryAll([], 0)
  return best
}

/** A square's colour as read, and whether the reading was a close call. */
export interface Classified {
  color: Color
  /**
   * True when it might well be another colour: another one was nearly as
   * close, or the "9 of each" rule (4 on a 2x2) moved it off the colour it
   * looked most like. The app outlines these for the user to check.
   */
  unsure: boolean
  /**
   * For a square named from its photo: the next likeliest colour, and how
   * much worse the photo fits it than `color` (below 0 when the photo looks
   * more like it, and only "9 of each" moved it off). Not given for squares
   * picked by hand, or centres. See closeCalls.ts.
   */
  secondChoice?: { color: Color; cost: number }
}

/**
 * A square is a close call when the next nearest colour is less than this
 * much further away than the nearest (0.7: within about 40%).
 */
const SURE_RATIO = 0.7

/**
 * Names the colours of every side scanned so far. Each side is the readings
 * from one photo, row by row from the top left: 9 for a 3x3 (the centre is
 * reading 4), 4 for a 2x2. `fixed` gives the colours the user picked by
 * hand for some squares (null for the rest); those always stay as picked.
 *
 * Every square is shared out among the colours so that no colour gets more
 * squares than a real cube has (9 on a 3x3, 4 on a 2x2), while each square
 * stays as close to its colour as possible overall. Squares that look like
 * nothing else keep their nearest colour; when, say, 11 squares look red on
 * a 3x3, the 2 least red of them go to the colour that's short, often
 * orange. With all six sides in, every colour ends up with exactly its
 * share.
 *
 * What each colour looks like (the references squares are compared with)
 * starts as typical photo colours, `start`, and is then learned from the
 * photos: on a 3x3 from the centres (see classifyByCenters), on a 2x2 from
 * the squares themselves (see classifyWithoutCenters).
 */
export function classifySides(
  sides: readonly (readonly Lab[])[],
  {
    fixed = [],
    start = PHOTO_COLORS,
  }: {
    fixed?: readonly (readonly (Color | null)[])[]
    start?: References
  } = {},
): Classified[][] {
  if (sides.length === 0) return []
  const picked = sides.map((side, i) =>
    side.map((_, n) => fixed[i]?.[n] ?? null),
  )
  const { hasCenters, cellsPerColor } = puzzleOfSide(sides[0])
  return hasCenters
    ? classifyByCenters(sides, picked, start, cellsPerColor)
    : classifyWithoutCenters(sides, picked, start, cellsPerColor)
}

/**
 * A 3x3's sides:
 * 1. The centres are named by matchCenters.
 * 2. Each centre becomes the reference for its colour (unless it looks
 *    nothing like it, see below).
 * 3. The other squares are shared out (see shareOut).
 */
function classifyByCenters(
  sides: readonly (readonly Lab[])[],
  picked: readonly (readonly (Color | null)[])[],
  start: References,
  perColor: number,
): Classified[][] {
  const centers = sides.map((side) => side[CENTER])
  const centerColors = matchCenters(
    centers,
    start,
    picked.map((side) => side[CENTER]),
  )
  const references: Record<Color, Lab> = { ...start }
  centers.forEach((center, i) => {
    const color = centerColors[i]
    // Light can make a colour look like its neighbour (warm light makes
    // white look yellow, say), so a centre still counts if its colour is the
    // nearest or the next nearest. But a logo can look like anything, and
    // mustn't become what white looks like.
    if (byDistance(center, start).indexOf(color) < 2) {
      references[color] = center
    }
  })
  const given = sides.map((side, i) =>
    side.map((square, n) => {
      const color = n === CENTER ? centerColors[i] : picked[i][n]
      if (color === null) return null // shared out
      const unsure =
        picked[i][n] === null && nearestColor(square, references) !== color
      return { color, unsure }
    }),
  )
  return shareOut(sides, given, references, perColor)
}

/**
 * From this many sides on, a 2x2's colours are learned from its photos:
 * with fewer, most colours have only a square or two to learn from.
 */
const LEARN_FROM_SIDES = 3

/** How many times to learn the colours and share the squares out again. */
const LEARNING_ROUNDS = 2

/**
 * A 2x2's sides. With no centres to learn from, the squares are first
 * shared out by typical photo colours. Once a few sides are in, each
 * colour's reference becomes the middle of the squares it got, and the
 * squares are shared out again by those: a better guide to your own cube in
 * your own light. Two rounds of that settle it.
 */
function classifyWithoutCenters(
  sides: readonly (readonly Lab[])[],
  picked: readonly (readonly (Color | null)[])[],
  start: References,
  perColor: number,
): Classified[][] {
  const given = picked.map((side) =>
    side.map((color) => color && { color, unsure: false }),
  )
  let named = shareOut(sides, given, start, perColor)
  if (sides.length >= LEARN_FROM_SIDES) {
    for (let round = 0; round < LEARNING_ROUNDS; round++) {
      named = shareOut(sides, given, learnedFrom(sides, named, start), perColor)
    }
  }
  return named
}

/**
 * Each colour's reference: the middle of the readings named that colour,
 * where at least two are, and it still looks like that colour (its nearest
 * or next nearest, as for a 3x3's centres). Otherwise the starting one.
 */
function learnedFrom(
  sides: readonly (readonly Lab[])[],
  named: readonly (readonly Classified[])[],
  start: References,
): References {
  const references: Record<Color, Lab> = { ...start }
  for (const color of COLORS) {
    const readings = sides.flatMap((side, i) =>
      side.filter((_, n) => named[i][n].color === color),
    )
    if (readings.length < 2) continue
    const middle = medianLab(readings)
    if (byDistance(middle, start).indexOf(color) < 2) {
      references[color] = middle
    }
  }
  return references
}

/**
 * Names the squares not `given` a colour already: they're shared out among
 * the colours so that no colour gets more than `perColor` squares, at the
 * lowest total distance from their colours' references.
 */
function shareOut(
  sides: readonly (readonly Lab[])[],
  given: readonly (readonly (Classified | null)[])[],
  references: References,
  perColor: number,
): Classified[][] {
  // How many of each colour's squares are already accounted for.
  const used = Object.fromEntries(COLORS.map((color) => [color, 0])) as Record<
    Color,
    number
  >
  for (const square of given.flat()) if (square) used[square.color]++
  const result = given.map((side) => [...side])

  // The rest: a row for each square, a column for each colour's spare slots.
  const squares = sides.flatMap((side, i) =>
    side.flatMap((reading, n) => (given[i][n] ? [] : [{ i, n, reading }])),
  )
  const slots = COLORS.flatMap((color) =>
    Array<Color>(Math.max(0, perColor - used[color])).fill(color),
  )
  const assignment = cheapestAssignment(
    squares.map(({ reading }) =>
      slots.map((color) => colorDistance(reading, references[color])),
    ),
  )
  squares.forEach(({ i, n, reading }, row) => {
    const color = slots[assignment[row]]
    const distance = (other: Color) => colorDistance(reading, references[other])
    const [nearest, next] = byDistance(reading, references)
    const closeCall = distance(nearest) > SURE_RATIO * distance(next)
    const second = color === nearest ? next : nearest
    result[i][n] = {
      color,
      unsure: color !== nearest || closeCall,
      secondChoice: { color: second, cost: distance(second) - distance(color) },
    }
  })
  return result as Classified[][] // every square has its colour now
}

/** The middle value of each of l, a and b. */
function medianLab(readings: readonly Lab[]): Lab {
  const middle = (values: number[]) => {
    const sorted = values.sort((x, y) => x - y)
    const half = sorted.length / 2
    return Number.isInteger(half)
      ? (sorted[half - 1] + sorted[half]) / 2
      : sorted[Math.floor(half)]
  }
  return {
    l: middle(readings.map(({ l }) => l)),
    a: middle(readings.map(({ a }) => a)),
    b: middle(readings.map(({ b }) => b)),
  }
}

/** All six colours, nearest first. */
function byDistance(reading: Lab, references: References): Color[] {
  const distance = (color: Color) => colorDistance(reading, references[color])
  return [...COLORS].sort((x, y) => distance(x) - distance(y))
}
