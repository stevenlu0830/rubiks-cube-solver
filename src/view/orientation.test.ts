import { Matrix4, Quaternion } from 'three'
import { describe, expect, it } from 'vitest'
import { applyMoves, type Move } from '../cube/moves.ts'
import {
  CENTER,
  cellIndex,
  FACES,
  solvedState,
  STANDARD_SCHEME,
  type Face,
} from '../cube/state.ts'
import { seededRandom } from '../test/seededRandom.ts'
import type { SwipeDirection } from './gestures.ts'
import { frontFace, topFace, turnBySwipe } from './orientation.ts'

const SWIPES: SwipeDirection[] = ['left', 'right', 'up', 'down']

/** The cube-notation move each swipe should match. */
const SWIPE_MOVES: Record<SwipeDirection, Move> = {
  left: 'y',
  right: "y'",
  up: 'x',
  down: "x'",
}

const swipeAll = (directions: SwipeDirection[]) =>
  directions.reduce(turnBySwipe, new Quaternion())

const matrixOf = (q: Quaternion) =>
  new Matrix4().makeRotationFromQuaternion(q).elements

/** Two quaternions can describe the same rotation, so compare the rotations themselves. */
const sameRotation = (a: Quaternion, b: Quaternion) => {
  const [ma, mb] = [matrixOf(a), matrixOf(b)]
  return ma.every((value, i) => Math.abs(value - mb[i]) < 1e-9)
}

/** Which face's colour sits at the front/top centre after these moves, per the Phase 1 engine. */
const faceShownAfterMoves = (moves: Move[], position: Face): Face => {
  const color = applyMoves(solvedState(), moves)[cellIndex(position, CENTER)]
  return FACES.find((face) => STANDARD_SCHEME[face] === color)!
}

describe('turnBySwipe', () => {
  it('starts with the front face in front and the top face on top', () => {
    expect(frontFace(new Quaternion())).toBe('F')
    expect(topFace(new Quaternion())).toBe('U')
  })

  it.each<[SwipeDirection, Face]>([
    ['left', 'R'],
    ['right', 'L'],
    ['up', 'D'],
    ['down', 'U'],
  ])('swipe %s brings the %s face to the front', (direction, face) => {
    expect(frontFace(swipeAll([direction]))).toBe(face)
  })

  it('matches the x and y moves of the cube engine, for any sequence of swipes', () => {
    const random = seededRandom(7)
    for (let run = 0; run < 100; run++) {
      const swipes = Array.from(
        { length: 1 + Math.floor(random() * 12) },
        () => SWIPES[Math.floor(random() * 4)],
      )
      const moves = swipes.map((direction) => SWIPE_MOVES[direction])
      const orientation = swipeAll(swipes)
      expect(frontFace(orientation)).toBe(faceShownAfterMoves(moves, 'F'))
      expect(topFace(orientation)).toBe(faceShownAfterMoves(moves, 'U'))
    }
  })

  it.each(SWIPES)('four swipes %s return to the start', (direction) => {
    const orientation = swipeAll([direction, direction, direction, direction])
    expect(sameRotation(orientation, new Quaternion())).toBe(true)
  })

  it('undoes a swipe with the opposite swipe', () => {
    expect(sameRotation(swipeAll(['left', 'right']), new Quaternion())).toBe(
      true,
    )
    expect(sameRotation(swipeAll(['up', 'down']), new Quaternion())).toBe(true)
  })

  it('can reach all 24 ways a cube can sit, and no others', () => {
    const key = (q: Quaternion) => matrixOf(q).map(Math.round).join()
    const seen = new Map([[key(new Quaternion()), new Quaternion()]])
    const queue = [new Quaternion()]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const direction of SWIPES) {
        const next = turnBySwipe(current, direction)
        if (!seen.has(key(next))) {
          seen.set(key(next), next)
          queue.push(next)
        }
      }
    }
    expect(seen.size).toBe(24)
  })

  it('stays exactly square after 1000 swipes: rounding errors never build up', () => {
    const random = seededRandom(8)
    const swipes = Array.from(
      { length: 1000 },
      () => SWIPES[Math.floor(random() * 4)],
    )
    const orientation = swipeAll(swipes)
    for (const value of matrixOf(orientation)) {
      expect(Math.abs(value - Math.round(value))).toBeLessThan(1e-12)
    }
  })
})
