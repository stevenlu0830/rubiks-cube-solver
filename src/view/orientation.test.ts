import { Matrix4, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { dot, faceNormal, STICKERS } from '../cube/geometry.ts'
import { applyMoves, randomScramble, type Move } from '../cube/moves.ts'
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
import {
  cubeAsShown,
  faceTowards,
  frontCells,
  frontFace,
  topFace,
  turnBySwipe,
} from './orientation.ts'

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

/** Every orientation swipes can reach, found by trying every swipe from each. */
function allOrientations(): Quaternion[] {
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
  return [...seen.values()]
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
    expect(allOrientations()).toHaveLength(24)
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

describe('cubeAsShown', () => {
  const NUMBERED = Array.from({ length: 54 }, (_, i) => i)

  it('changes nothing before any swipe', () => {
    expect(cubeAsShown(NUMBERED, new Quaternion())).toEqual(NUMBERED)
  })

  it('reads the cells exactly as the matching x/y moves would move them', () => {
    const random = seededRandom(9)
    for (let run = 0; run < 100; run++) {
      const swipes = Array.from(
        { length: Math.floor(random() * 8) },
        () => SWIPES[Math.floor(random() * 4)],
      )
      const moves = swipes.map((direction) => SWIPE_MOVES[direction])
      expect(cubeAsShown(NUMBERED, swipeAll(swipes))).toEqual(
        applyMoves(NUMBERED, moves),
      )
    }
  })

  it('shows the colours of the face now in front at the front', () => {
    const cube = applyMoves(solvedState(), randomScramble(25, seededRandom(10)))
    const orientation = swipeAll(['up']) // bottom face comes to the front
    expect(cubeAsShown(cube, orientation)[cellIndex('F', CENTER)]).toBe(
      cube[cellIndex('D', CENTER)],
    )
  })
})

describe('frontCells', () => {
  const cellsOf = (face: Face) =>
    Array.from({ length: 9 }, (_, n) => cellIndex(face, n))

  it.each<[string, SwipeDirection[], Face]>([
    ['before any swipe', [], 'F'],
    ['after a swipe left', ['left'], 'R'],
    ['after a swipe right', ['right'], 'L'],
    ['after a swipe up', ['up'], 'D'],
    ['after a swipe down', ['down'], 'U'],
    ['after two swipes left', ['left', 'left'], 'B'],
  ])('%s, reads the face in front in its usual order', (_, swipes, face) => {
    expect(frontCells(swipeAll(swipes))).toEqual(cellsOf(face))
  })

  it('reads a side turned on its edge from its new top left', () => {
    // Up, left, down: the cube ends up turned a quarter clockwise, so the
    // front's old bottom-left corner (F6) is now at the top left.
    expect(frontCells(swipeAll(['up', 'left', 'down']))).toEqual([
      24, 21, 18, 25, 22, 19, 26, 23, 20,
    ])
  })

  it('in all 24 ways the cube can sit, reads the front row by row from the top left', () => {
    /** True when this cell is on the edge of its face next to `face`. */
    const touches = (cell: number, face: Face) =>
      dot(STICKERS[cell].position, faceNormal(face)) === 1
    for (const orientation of allOrientations()) {
      const cells = frontCells(orientation)
      const front = frontFace(orientation)
      expect([...cells].sort((a, b) => a - b)).toEqual(cellsOf(front))
      expect(cells[CENTER]).toBe(cellIndex(front, CENTER))

      const [top, bottom, left, right] = [
        new Vector3(0, 1, 0),
        new Vector3(0, -1, 0),
        new Vector3(-1, 0, 0),
        new Vector3(1, 0, 0),
      ].map((direction) => faceTowards(orientation, direction))
      cells.forEach((cell, n) => {
        const [row, column] = [Math.floor(n / 3), n % 3]
        expect(touches(cell, top), `${n} on top`).toBe(row === 0)
        expect(touches(cell, bottom), `${n} at the bottom`).toBe(row === 2)
        expect(touches(cell, left), `${n} on the left`).toBe(column === 0)
        expect(touches(cell, right), `${n} on the right`).toBe(column === 2)
      })
    }
  })
})
