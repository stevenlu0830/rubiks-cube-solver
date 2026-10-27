import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { faceNormal, STICKERS } from '../cube/geometry.ts'
import { applyMove, MOVES } from '../cube/moves.ts'
import { TURN_GUIDES, turnedFace } from '../solve/moveGuide.ts'
import { arrowPlacement } from './arrows.ts'

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
