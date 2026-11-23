import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { faceNormal, STICKERS, stickersOf } from '../../src/cube/geometry.ts'
import { applyMove, MOVES, movesOf } from '../../src/cube/moves.ts'
import { PUZZLE_2X2, PUZZLE_4X4 } from '../../src/cube/puzzle.ts'
import {
  layerGuideOf,
  TURN_GUIDES,
  turnedFace,
  turnGuidesOf,
} from '../../src/solve/moveGuide.ts'
import { arrowPlacements } from '../../src/view/arrows.ts'
import type { Move } from '../../src/cube/moves.ts'
import type { Puzzle } from '../../src/cube/puzzle.ts'

/** The one arrow a face turn has. */
const arrowPlacement = (move: Move, puzzle?: Puzzle) => {
  const placements = arrowPlacements(move, puzzle)
  expect(placements).toHaveLength(1)
  return placements[0]
}

const FACE_TURNS = MOVES.filter((move) => /^[URFDLB]/.test(move))
const NUMBERED = Array.from({ length: 54 }, (_, i) => i)

describe('arrowPlacement', () => {
  it.each(FACE_TURNS)(
    '%s: the arrow lies just above the front or top face',
    (move) => {
      const { position, quaternion } = arrowPlacement(move)
      const face = new Vector3(
        ...faceNormal(TURN_GUIDES[turnedFace(move)!].face),
      )
      expect(position.dot(face)).toBeGreaterThan(1.5)
      const facing = new Vector3(0, 0, 1).applyQuaternion(quaternion)
      expect(facing.dot(face)).toBeCloseTo(1)
    },
  )

  it.each(FACE_TURNS.filter((move) => !move.endsWith('2')))(
    '%s: the arrow points the way the stickers under it really move',
    (move) => {
      const { quaternion } = arrowPlacement(move)
      const pointing = new Vector3(1, 0, 0).applyQuaternion(quaternion)
      const middle = TURN_GUIDES[turnedFace(move)!].cells[1]
      const landsAt = applyMove(NUMBERED, move).indexOf(middle)
      const moved = new Vector3(...STICKERS[landsAt].position).sub(
        new Vector3(...STICKERS[middle].position),
      )
      expect(moved.dot(pointing)).toBeGreaterThan(0)
    },
  )

  it('uses a two-headed arrow only for half turns', () => {
    expect(arrowPlacement('R2').doubleHeaded).toBe(true)
    expect(arrowPlacement('R').doubleHeaded).toBe(false)
    expect(arrowPlacement("R'").doubleHeaded).toBe(false)
  })
})

describe('arrowPlacement on a 2x2', () => {
  const stickers = stickersOf(PUZZLE_2X2)
  const guides = turnGuidesOf(PUZZLE_2X2)
  const NUMBERED_2X2 = Array.from({ length: 24 }, (_, i) => i)

  it.each(FACE_TURNS)(
    '%s: the arrow lies just above the front or top face, between its two stickers',
    (move) => {
      const { position, quaternion } = arrowPlacement(move, PUZZLE_2X2)
      const guide = guides[turnedFace(move)!]
      const face = new Vector3(...faceNormal(guide.face))
      // A 2x2's faces are 1 out from the middle; the arrow floats just above.
      expect(position.dot(face)).toBeGreaterThan(1)
      expect(position.dot(face)).toBeLessThan(1.1)
      const [a, b] = guide.cells.map((cell) => stickers[cell].position)
      const middle = new Vector3(...a)
        .add(new Vector3(...b))
        .multiplyScalar(0.5)
      const sideways = position.clone().sub(middle)
      expect(
        sideways.sub(face.multiplyScalar(sideways.dot(face))).length(),
      ).toBeCloseTo(0)
      const facing = new Vector3(0, 0, 1).applyQuaternion(quaternion)
      expect(facing.dot(new Vector3(...faceNormal(guide.face)))).toBeCloseTo(1)
    },
  )

  it.each(FACE_TURNS.filter((move) => !move.endsWith('2')))(
    '%s: the arrow points the way the stickers under it really move',
    (move) => {
      const { quaternion } = arrowPlacement(move, PUZZLE_2X2)
      const pointing = new Vector3(1, 0, 0).applyQuaternion(quaternion)
      // Where each sticker's face is: on a 2x2 they're all on corners, and
      // the end one wraps round the edge (see moveGuide.test.ts).
      const surface = (cell: number) =>
        new Vector3(...stickers[cell].position).addScaledVector(
          new Vector3(...stickers[cell].normal),
          0.5,
        )
      for (const cell of guides[turnedFace(move)!].cells) {
        const landsAt = applyMove(NUMBERED_2X2, move).indexOf(cell)
        const moved = surface(landsAt).sub(surface(cell))
        expect(moved.dot(pointing)).toBeGreaterThan(0)
      }
    },
  )
})

describe('arrowPlacements on a 4x4', () => {
  const stickers = stickersOf(PUZZLE_4X4)
  const NUMBERED_4X4 = Array.from({ length: 96 }, (_, i) => i)
  const TURNS = movesOf(PUZZLE_4X4).filter(
    (move) => !/^[xyz]/.test(move) && !move.endsWith('2'),
  )
  const surface = (cell: number) =>
    new Vector3(...stickers[cell].position).addScaledVector(
      new Vector3(...stickers[cell].normal),
      0.5,
    )

  it.each(TURNS)(
    '%s: one arrow along each line of moving stickers, just above it, pointing the way they move',
    (move) => {
      const guide = layerGuideOf(move, PUZZLE_4X4)
      const placements = arrowPlacements(move, PUZZLE_4X4)
      expect(placements).toHaveLength(guide.lines.length)
      const face = new Vector3(...faceNormal(guide.face))
      placements.forEach(({ position, quaternion }, i) => {
        // A 4x4's faces are 2 out from the middle; the arrow floats just above.
        expect(position.dot(face)).toBeGreaterThan(2)
        expect(position.dot(face)).toBeLessThan(2.1)
        // Over the middle of its line.
        const line = guide.lines[i]
        const middle = new Vector3()
        for (const cell of line) middle.add(surface(cell))
        middle.multiplyScalar(1 / line.length)
        const sideways = position.clone().sub(middle)
        expect(
          sideways
            .sub(face.clone().multiplyScalar(sideways.dot(face)))
            .length(),
        ).toBeCloseTo(0)
        const pointing = new Vector3(1, 0, 0).applyQuaternion(quaternion)
        for (const cell of line) {
          const landsAt = applyMove(NUMBERED_4X4, move).indexOf(cell)
          expect(
            surface(landsAt).sub(surface(cell)).dot(pointing),
          ).toBeGreaterThan(0)
        }
      })
    },
  )

  it('gives a wide turn two arrows side by side, and its half turn two two-headed ones', () => {
    expect(arrowPlacements('Rw', PUZZLE_4X4)).toHaveLength(2)
    expect(
      arrowPlacements('Rw2', PUZZLE_4X4).map(
        ({ doubleHeaded }) => doubleHeaded,
      ),
    ).toEqual([true, true])
    expect(arrowPlacements('r', PUZZLE_4X4)).toHaveLength(1)
  })
})
