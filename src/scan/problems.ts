/**
 * Spotting a picture that will read badly, before the photo is taken: too
 * dark, glare on the stickers, or a phone that's moving.
 */

import type { Color } from '../cube/state.ts'
import type { Lab } from './colorSpace.ts'
import type { Square } from './sample.ts'

export type PictureProblem = 'dark' | 'glare' | 'moving'

export const PROBLEM_MESSAGES: Record<PictureProblem, string> = {
  dark: 'Too dark: move somewhere brighter.',
  glare: 'Shine on the stickers: tilt the cube a little.',
  moving: 'Hold still…',
}

/**
 * Too dark when even the brightest square is this dark (lightness, 0 to
 * 100). Phones brighten dim pictures themselves, so this only happens in
 * real gloom: in ordinary light, even blue stickers read about 30.
 */
const DARK = 20

/** Glare when this much of a coloured square is shine. */
const GLARE = 0.1

/**
 * Moving when the squares change by more than this between two looks, on
 * average (Lab distance). Camera noise is about 1 to 3.
 */
const MOVING = 10

/**
 * What's wrong with the picture, if anything, worst first. `named` is the
 * colour each square reads as; `before` is the previous look at the same
 * side, a moment earlier, if any.
 */
export function pictureProblem(
  squares: readonly Square[],
  readings: readonly Lab[],
  named: readonly Color[],
  before: readonly Lab[] | null,
): PictureProblem | null {
  if (Math.max(...readings.map(({ l }) => l)) < DARK) return 'dark'
  // A white sticker brightly lit can look like glare all over; that's fine.
  if (squares.some(({ glare }, n) => glare >= GLARE && named[n] !== 'white')) {
    return 'glare'
  }
  if (before && averageChange(before, readings) > MOVING) return 'moving'
  return null
}

function averageChange(before: readonly Lab[], now: readonly Lab[]): number {
  const total = now.reduce(
    (sum, { l, a, b }, n) =>
      sum + Math.hypot(l - before[n].l, a - before[n].a, b - before[n].b),
    0,
  )
  return total / now.length
}
