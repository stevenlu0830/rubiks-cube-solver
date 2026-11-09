/**
 * Keeping track of the sides scanned so far: naming their colours, picking
 * the next side to scan, and saying how to turn a real cube to it.
 *
 * Each photo fills whichever side of the 3D cube faces the user. The user
 * turns their real cube the same way as the 3D one between photos, so the
 * app always knows which side a photo shows.
 */

import { Vector3, type Quaternion } from 'three'
import { CENTER, COLORS, FACES, type Color, type Face } from '../cube/state.ts'
import type { SwipeDirection } from '../view/gestures.ts'
import { faceTowards, frontFace } from '../view/orientation.ts'
import {
  classifySides,
  colorDistance,
  matchCenters,
  PHOTO_COLORS,
  type Classified,
} from './classify.ts'
import type { Lab, Rgb } from './colorSpace.ts'

/** One side's photo: what the camera read, and where on the cube it goes. */
export interface ScannedSide {
  /** The cells the photo filled, in photo order (row by row from its top left). */
  cells: readonly number[]
  /** The camera's colour for each square, in the same order. */
  rgb: readonly Rgb[]
  /** The same, in Lab: what the colours are named from. */
  readings: readonly Lab[]
}

/** The sides photographed so far, by the face each went on. */
export type ScannedSides = Partial<Record<Face, ScannedSide>>

/** Colours the user picked by hand, by cell. */
export type Fixes = Readonly<Partial<Record<number, Color>>>

/**
 * Names every scanned square at once, by cell: the centres of all the
 * sides, and the "9 of each colour" rule, help with each (see
 * classifySides). So a new photo can change squares on earlier sides too,
 * but never the ones in `fixes`.
 */
export function readScannedCube(
  sides: ScannedSides,
  fixes: Fixes = {},
): Map<number, Classified> {
  const faces = FACES.filter((face) => sides[face])
  const named = classifySides(
    faces.map((face) => sides[face]!.readings),
    {
      fixed: faces.map((face) =>
        sides[face]!.cells.map((cell) => fixes[cell] ?? null),
      ),
    },
  )
  const cube = new Map<number, Classified>()
  faces.forEach((face, i) =>
    sides[face]!.cells.forEach((cell, n) => cube.set(cell, named[i][n])),
  )
  return cube
}

/**
 * Two photos of the same sticker in the same light read within about this
 * far apart; different colours, even red and orange, are much further.
 */
const SAME_STICKER = 12

/**
 * The side already scanned that this photo looks like a second photo of,
 * if any: its centre reads almost the same as that side's centre, and
 * closer than to any colour no other side has. That usually means the real
 * cube was turned differently from the 3D one.
 */
export function repeatedSide(sides: ScannedSides, face: Face): Face | null {
  const center = sides[face]?.readings[CENTER]
  if (!center) return null
  const others = FACES.filter((other) => other !== face && sides[other])
  if (others.length === 0) return null
  const otherCenters = others.map((other) => sides[other]!.readings[CENTER])
  const distances = otherCenters.map((other) => colorDistance(center, other))
  const closest = Math.min(...distances)
  if (closest > SAME_STICKER) return null
  // Could it be one of the colours nobody has yet, instead?
  const claimed = matchCenters(otherCenters)
  const unclaimed = COLORS.filter((color) => !claimed.includes(color))
  if (
    unclaimed.some(
      (color) => colorDistance(center, PHOTO_COLORS[color]) <= closest,
    )
  ) {
    return null
  }
  return others[distances.indexOf(closest)]
}

const OPPOSITE: Record<Face, Face> = {
  U: 'D',
  D: 'U',
  F: 'B',
  B: 'F',
  R: 'L',
  L: 'R',
}

/**
 * Quarter turns needed to bring one side to the front from another: one
 * for any side next to it, two for the side opposite.
 */
function turnsBetween(from: Face, to: Face): number {
  if (from === to) return 0
  return OPPOSITE[from] === to ? 2 : 1
}

/** The fewest quarter turns that bring each of `faces` to the front, in any order. */
function shortestTour(front: Face, faces: readonly Face[]): number {
  if (faces.length === 0) return 0
  return Math.min(
    ...faces.map(
      (face) =>
        turnsBetween(front, face) +
        shortestTour(
          face,
          faces.filter((other) => other !== face),
        ),
    ),
  )
}

/**
 * Each swipe, and the side of the screen it brings to the front, in the
 * order they're preferred: turning a cube left or right in your hand is
 * easier than tipping it.
 */
const SWIPES: readonly [SwipeDirection, Vector3][] = [
  ['left', new Vector3(1, 0, 0)],
  ['right', new Vector3(-1, 0, 0)],
  ['down', new Vector3(0, 1, 0)],
  ['up', new Vector3(0, -1, 0)],
]

/** The swipes that bring `face` to the front. */
function swipesTo(orientation: Quaternion, face: Face): SwipeDirection[] {
  if (frontFace(orientation) === face) return []
  const swipe = SWIPES.find(
    ([, side]) => faceTowards(orientation, side) === face,
  )
  // Not on any side of the screen: it's at the back, so turn the cube round.
  return swipe ? [swipe[0]] : ['left', 'left']
}

/**
 * The swipes that turn the cube to the next side to scan: the nearest one
 * not scanned yet. Of sides equally near, it picks one that leaves the
 * shortest way round the rest, so a whole cube takes five quarter turns
 * (two would be wasted going straight across to the opposite side). Empty
 * when the side in front still needs scanning; null once all six are done.
 */
export function nextSideTurns(
  orientation: Quaternion,
  scanned: ReadonlySet<Face>,
): SwipeDirection[] | null {
  const left = FACES.filter((face) => !scanned.has(face))
  if (left.length === 0) return null
  const preference = (swipes: SwipeDirection[]) =>
    SWIPES.findIndex(([swipe]) => swipe === swipes[0])
  const options = left.map((face) => ({
    swipes: swipesTo(orientation, face),
    rest: shortestTour(
      face,
      left.filter((other) => other !== face),
    ),
  }))
  options.sort(
    (a, b) =>
      a.swipes.length - b.swipes.length ||
      a.rest - b.rest ||
      preference(a.swipes) - preference(b.swipes),
  )
  return options[0].swipes
}

/** How to turn a real cube the way these swipes turn the 3D one. */
const TURNS: Record<SwipeDirection, { turn: string; side: string }> = {
  left: { turn: 'turn your cube to the left', side: 'right' },
  right: { turn: 'turn your cube to the right', side: 'left' },
  up: { turn: 'tip the top of your cube away from you', side: 'bottom' },
  down: { turn: 'tip the top of your cube towards you', side: 'top' },
}

/**
 * The swipes as an instruction for someone holding a real cube, e.g. "Turn
 * your cube to the left, so its right side faces you".
 */
export function turnInstruction(swipes: readonly SwipeDirection[]): string {
  let text: string
  if (swipes.length === 1) {
    const { turn, side } = TURNS[swipes[0]]
    text = `${turn}, so its ${side} side faces you`
  } else if (
    swipes.length === 2 &&
    swipes[0] === swipes[1] &&
    (swipes[0] === 'left' || swipes[0] === 'right')
  ) {
    text = 'turn your cube around, so its back side faces you'
  } else {
    text = swipes.map((swipe) => TURNS[swipe].turn).join(', then ')
  }
  return text.charAt(0).toUpperCase() + text.slice(1)
}
