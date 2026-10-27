import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { STICKERS, stickerIndexAt } from '../cube/geometry.ts'
import { applyMove, MOVES, type Move } from '../cube/moves.ts'
import { isInTurningLayer, turnRotation } from './turns.ts'

const FACE_TURNS = MOVES.filter((move) => /^[URFDLB]/.test(move))
const NUMBERED = Array.from({ length: 54 }, (_, i) => i)

describe('face turn animation', () => {
  it('covers all 18 face turns', () => {
    expect(FACE_TURNS).toHaveLength(18)
  })

  it.each(FACE_TURNS)('%s turns a layer of 9 pieces', (move) => {
    const layer = new Set(
      STICKERS.filter(({ position }) => isInTurningLayer(position, move)).map(
        ({ position }) => position.join(),
      ),
    )
    expect(layer.size).toBe(9)
  })

  it.each(FACE_TURNS)(
    '%s rotates every sticker to exactly where the move engine puts it',
    (move: Move) => {
      const after = applyMove(NUMBERED, move)
      const { axis, angle } = turnRotation(move)
      const rotation = new Quaternion().setFromAxisAngle(axis, angle)
      STICKERS.forEach(({ position, normal }, cell) => {
        if (!isInTurningLayer(position, move)) {
          expect(after[cell]).toBe(cell) // pieces outside the layer stay put
          return
        }
        const p = new Vector3(...position).applyQuaternion(rotation).round()
        const n = new Vector3(...normal).applyQuaternion(rotation).round()
        const landsAt = stickerIndexAt(p.toArray(), n.toArray())
        expect(after[landsAt]).toBe(cell)
      })
    },
  )
})
