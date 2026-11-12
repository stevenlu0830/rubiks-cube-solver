import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { faceNormal, STICKERS, stickersOf } from '../../src/cube/geometry.ts'
import { applyMove, MOVES } from '../../src/cube/moves.ts'
import { PUZZLE_2X2 } from '../../src/cube/puzzle.ts'
import {
  TURN_GUIDES,
  turnedFace,
  turnGuidesOf,
} from '../../src/solve/moveGuide.ts'
import { arrowPlacement } from '../../src/view/arrows.ts'

const FACE_TURNS = MOVES.filter((move) => /^[URFDLB]/.test(move))
const NUMBERED = Array.from({ length: 54 }, (_, i) => i)

describe('arrowPlacement', () => {
  it.each(FACE_TURNS)(
    '%s: the arrow lies just above the front or top face',
    (move) => {
      const { position, quaternion } = arrowPlacement(move)
      const face = new Vector3(
        ...faceNormal(TURN_GUIDES[turnedFace(move)].face),
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
      const middle = TURN_GUIDES[turnedFace(move)].cells[1]
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
      const guide = guides[turnedFace(move)]
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
      for (const cell of guides[turnedFace(move)].cells) {
        const landsAt = applyMove(NUMBERED_2X2, move).indexOf(cell)
        const moved = surface(landsAt).sub(surface(cell))
        expect(moved.dot(pointing)).toBeGreaterThan(0)
      }
    },
  )
})
