import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  snapToGrid,
  STICKERS,
  stickerIndexAt,
  stickersOf,
} from '../../src/cube/geometry.ts'
import { applyMove, MOVES, movesOf, type Move } from '../../src/cube/moves.ts'
import { PUZZLE_2X2, PUZZLE_4X4 } from '../../src/cube/puzzle.ts'
import { isInTurningLayer, turnRotation } from '../../src/view/turns.ts'

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

describe('face turn animation on a 2x2', () => {
  const stickers = stickersOf(PUZZLE_2X2)
  const NUMBERED_2X2 = Array.from({ length: 24 }, (_, i) => i)

  it.each(FACE_TURNS)('%s turns a layer of 4 pieces', (move) => {
    const layer = new Set(
      stickers
        .filter(({ position }) => isInTurningLayer(position, move, PUZZLE_2X2))
        .map(({ position }) => position.join()),
    )
    expect(layer.size).toBe(4)
  })

  it.each(FACE_TURNS)(
    '%s rotates every sticker to exactly where the move engine puts it',
    (move: Move) => {
      const after = applyMove(NUMBERED_2X2, move)
      const { axis, angle } = turnRotation(move)
      const rotation = new Quaternion().setFromAxisAngle(axis, angle)
      stickers.forEach(({ position, normal }, cell) => {
        if (!isInTurningLayer(position, move, PUZZLE_2X2)) {
          expect(after[cell]).toBe(cell) // pieces outside the layer stay put
          return
        }
        const p = new Vector3(...position).applyQuaternion(rotation)
        const n = new Vector3(...normal).applyQuaternion(rotation)
        const landsAt = stickerIndexAt(
          snapToGrid(p.toArray()),
          snapToGrid(n.toArray()),
          PUZZLE_2X2,
        )
        expect(after[landsAt]).toBe(cell)
      })
    },
  )
})

describe('turn animation on a 4x4', () => {
  const stickers = stickersOf(PUZZLE_4X4)
  const NUMBERED_4X4 = Array.from({ length: 96 }, (_, i) => i)
  /** Every turn but the whole-cube ones: 18 face, 18 wide and 18 inner-layer turns. */
  const TURNS = movesOf(PUZZLE_4X4).filter((move) => !/^[xyz]/.test(move))
  /** The pieces that show (have stickers) in the layers a move turns. */
  const piecesTurnedBy = (move: Move) =>
    new Set(
      stickers
        .filter(({ position }) => isInTurningLayer(position, move, PUZZLE_4X4))
        .map(({ position }) => position.join()),
    )

  it('covers all 54 turns', () => {
    expect(TURNS).toHaveLength(54)
  })

  it.each(FACE_TURNS)('%s turns a layer of 16 pieces', (move) => {
    expect(piecesTurnedBy(move).size).toBe(16)
  })

  it.each(TURNS.filter((move) => /^[urfdlb]/.test(move)))(
    '%s turns an inner layer of 16 pieces, of which 12 show',
    (move) => {
      expect(piecesTurnedBy(move).size).toBe(12)
    },
  )

  it.each(TURNS.filter((move) => move.includes('w')))(
    '%s turns two layers: 28 pieces that show (16 + 12)',
    (move) => {
      expect(piecesTurnedBy(move).size).toBe(28)
    },
  )

  it.each(TURNS)(
    '%s rotates every sticker to exactly where the move engine puts it',
    (move: Move) => {
      const after = applyMove(NUMBERED_4X4, move)
      const { axis, angle } = turnRotation(move)
      const rotation = new Quaternion().setFromAxisAngle(axis, angle)
      stickers.forEach(({ position, normal }, cell) => {
        if (!isInTurningLayer(position, move, PUZZLE_4X4)) {
          expect(after[cell]).toBe(cell) // pieces outside the layers stay put
          return
        }
        const p = new Vector3(...position).applyQuaternion(rotation)
        const n = new Vector3(...normal).applyQuaternion(rotation)
        const landsAt = stickerIndexAt(
          snapToGrid(p.toArray()),
          snapToGrid(n.toArray()),
          PUZZLE_4X4,
        )
        expect(after[landsAt]).toBe(cell)
      })
    },
  )
})
