/**
 * Keeping track of the sides scanned so far: naming their colours, picking
 * the next side to scan, and saying how to turn a real cube to it.
 *
 * Each photo fills whichever side of the 3D cube faces the user. The user
 * turns their real cube the same way as the 3D one between photos, so the
 * app always knows which side a photo shows.
 */

import { Vector3, type Quaternion } from 'three'
import { puzzleOfSide } from '../cube/puzzle.ts'
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
import { settleCloseCalls } from './closeCalls.ts'
import type { Lab, Rgb } from './colorSpace.ts'
import { findTurnedSides, turnCells } from './turnedSides.ts'

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
 * Names every scanned square at once, by cell: all the sides, and the "9
 * of each colour" rule (4 on a 2x2), help with each (see classifySides). So
 * a new photo can change squares on earlier sides too, but never the ones
 * in `fixes`. Once a 2x2's six sides are in, its close calls are settled by
 * the check before solving (see closeCalls.ts).
 */
export function readScannedCube(
  sides: ScannedSides,
  fixes: Fixes = {},
): ReadonlyMap<number, Classified> {
  const faces = FACES.filter((face) => sides[face])
  if (faces.length === 0) return new Map()
  const puzzle = puzzleOfSide(sides[faces[0]]!.cells)
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
  // A side photographed turned is fixed differently (see turnedSides.ts).
  if (puzzle.hasCenters || findTurnedSides(sides, cube)) return cube
  return settleCloseCalls(cube, puzzle.cellCount)
}

/**
 * Two photos of the same sticker in the same light read within about this
 * far apart; different colours, even red and orange, are much further.
 */
const SAME_STICKER = 12

/**
 * The side already scanned that this photo looks like a second photo of,
 * if any. That usually means the real cube was turned differently from the
 * 3D one.
 *
 * On a 3x3, its centre reads almost the same as that side's centre, and
 * closer than to any colour no other side has: every side's centre is a
 * different colour. A 2x2 has no centre, so every square must read almost
 * the same as that side's, with the photo turned any of the 4 ways. Now
 * and then (on about 1 in 60 scrambled 2x2s) two different sides really do
 * look alike, so for a 2x2 this is only "looks like".
 */
export function repeatedSide(sides: ScannedSides, face: Face): Face | null {
  const side = sides[face]
  if (!side) return null
  const others = FACES.filter((other) => other !== face && sides[other])
  if (others.length === 0) return null
  if (!puzzleOfSide(side.cells).hasCenters) {
    return lookAlikeSide(sides, side.readings, others)
  }
  const center = side.readings[CENTER]
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

/** The side, of `others`, whose squares all read almost the same as `readings`, turned any way. */
function lookAlikeSide(
  sides: ScannedSides,
  readings: readonly Lab[],
  others: readonly Face[],
): Face | null {
  let closest: Face | null = null
  let closestDistance = SAME_STICKER
  for (const other of others) {
    for (let turns = 0; turns < 4; turns++) {
      const turned = turnCells(sides[other]!.readings, turns)
      const furthest = Math.max(
        ...turned.map((reading, n) => colorDistance(reading, readings[n])),
      )
      if (furthest <= closestDistance) {
        closest = other
        closestDistance = furthest
      }
    }
  }
  return closest
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

type TurnWords = Record<SwipeDirection, { turn: string; then: string }>

/**
 * How to turn a real cube the way these swipes turn the 3D one, with a
 * phone's back camera: the camera sees the side facing you, as the 3D cube
 * shows it.
 */
const TURNS: TurnWords = {
  left: {
    turn: 'turn your cube to the left',
    then: 'its right side faces you',
  },
  right: {
    turn: 'turn your cube to the right',
    then: 'its left side faces you',
  },
  up: {
    turn: 'tip the top of your cube away from you',
    then: 'its bottom side faces you',
  },
  down: {
    turn: 'tip the top of your cube towards you',
    then: 'its top side faces you',
  },
}

/**
 * The same with a camera facing you, like a laptop's: the side to
 * photograph faces the camera, and you see the cube from behind. Turning
 * left or right is the same, but the side that comes round to the camera
 * is the one on the other hand; and tipping goes the other way.
 */
const TURNS_FACING_YOU: TurnWords = {
  left: {
    turn: 'turn your cube to the left',
    then: 'the side on your left faces the camera',
  },
  right: {
    turn: 'turn your cube to the right',
    then: 'the side on your right faces the camera',
  },
  up: {
    turn: 'tip the top of your cube towards you',
    then: 'its bottom side faces the camera',
  },
  down: {
    turn: 'tip the top of your cube away from you',
    then: 'its top side faces the camera',
  },
}

/**
 * The swipes as an instruction for someone holding a real cube, e.g. "Turn
 * your cube to the left, so its right side faces you". `facingYou`: the
 * camera faces the user, like a laptop's.
 */
export function turnInstruction(
  swipes: readonly SwipeDirection[],
  { facingYou = false }: { facingYou?: boolean } = {},
): string {
  const words = facingYou ? TURNS_FACING_YOU : TURNS
  let text: string
  if (swipes.length === 1) {
    const { turn, then } = words[swipes[0]]
    text = `${turn}, so ${then}`
  } else if (
    swipes.length === 2 &&
    swipes[0] === swipes[1] &&
    (swipes[0] === 'left' || swipes[0] === 'right')
  ) {
    text = facingYou
      ? 'turn your cube around, so the side facing you faces the camera'
      : 'turn your cube around, so its back side faces you'
  } else {
    text = swipes.map((swipe) => words[swipe].turn).join(', then ')
  }
  return text.charAt(0).toUpperCase() + text.slice(1)
}
