/**
 * Naming the colour of each square the camera read.
 *
 * Each reading is compared with a reference for every colour (what that
 * colour looks like in a photo), and takes the name of the nearest one. The
 * references start as typical photo colours, then each side's centre square
 * becomes the reference for its colour: your own cube, in your own light,
 * is the best guide to what its colours look like.
 */

import { CENTER, COLORS, type Color } from '../cube/state.ts'
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
 */
export function matchCenters(
  centers: readonly Lab[],
  references: References = PHOTO_COLORS,
): Color[] {
  if (centers.length > COLORS.length) {
    throw new RangeError('A cube only has six sides')
  }
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
    for (const color of COLORS) {
      if (chosen.includes(color)) continue
      tryAll(
        [...chosen, color],
        total + colorDistance(center, references[color]),
      )
    }
  }
  tryAll([], 0)
  return best
}

/**
 * Names the colours of every side scanned so far. Each side is the 9
 * readings from one photo, row by row from the top left, so the centre is
 * reading 4.
 *
 * 1. The centres are named by matchCenters.
 * 2. Each centre becomes the reference for its colour (unless it looks
 *    nothing like it, see below).
 * 3. Every other square takes the colour of its nearest reference.
 */
export function classifySides(
  sides: readonly (readonly Lab[])[],
  start: References = PHOTO_COLORS,
): Color[][] {
  const centers = sides.map((side) => side[CENTER])
  const centerColors = matchCenters(centers, start)
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
  return sides.map((side, i) =>
    side.map((square, n) =>
      n === CENTER ? centerColors[i] : nearestColor(square, references),
    ),
  )
}

/** All six colours, nearest first. */
function byDistance(reading: Lab, references: References): Color[] {
  const distance = (color: Color) => colorDistance(reading, references[color])
  return [...COLORS].sort((x, y) => distance(x) - distance(y))
}
