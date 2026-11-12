import { describe, expect, it } from 'vitest'
import { faceNormal, STICKERS, stickersOf } from '../../src/cube/geometry.ts'
import { applyMove } from '../../src/cube/moves.ts'
import { PUZZLE_2X2, PUZZLE_3X3 } from '../../src/cube/puzzle.ts'
import { FACES, type Face } from '../../src/cube/state.ts'
import {
  describeMove,
  TURN_GUIDES,
  turnedFace,
  turnGuidesOf,
} from '../../src/solve/moveGuide.ts'

const NUMBERED = Array.from({ length: 54 }, (_, i) => i)

/** Screen directions as 3D vectors, for stickers on the front or top face seen from the front. */
const DIRECTION_VECTORS = {
  left: [-1, 0, 0],
  right: [1, 0, 0],
  up: [0, 1, 0],
  down: [0, -1, 0],
} as const

const sub = (a: readonly number[], b: readonly number[]) =>
  a.map((v, i) => v - b[i])
const dot = (a: readonly number[], b: readonly number[]) =>
  a.reduce((sum, v, i) => sum + v * b[i], 0)

describe('describeMove', () => {
  it.each([
    ['R', 'Turn the right face clockwise (front stickers move up)'],
    ["R'", 'Turn the right face anticlockwise (front stickers move down)'],
    ['R2', 'Turn the right face twice (a half turn)'],
    ['U', 'Turn the top face clockwise (front stickers move left)'],
    ["D'", 'Turn the bottom face anticlockwise (front stickers move left)'],
    ['L', 'Turn the left face clockwise (front stickers move down)'],
    ['F', 'Turn the front face clockwise (top stickers move right)'],
    ['B', 'Turn the back face clockwise (top stickers move left)'],
  ] as const)('%s → %s', (move, text) => {
    expect(describeMove(move)).toBe(text)
  })

  it('refuses whole-cube turns, which never appear in a solution', () => {
    expect(() => turnedFace('x')).toThrow()
  })
})

describe('TURN_GUIDES', () => {
  it.each(FACES)(
    '%s: the guide stickers form a line on the front or top face',
    (face: Face) => {
      const guide = TURN_GUIDES[face]
      const [a, b, c] = guide.cells.map((cell) => STICKERS[cell])
      for (const sticker of [a, b, c]) {
        expect(sticker.normal).toEqual(faceNormal(guide.face))
      }
      // Evenly spaced, one step apart, in a straight line.
      expect(sub(b.position, a.position)).toEqual(sub(c.position, b.position))
      expect(
        dot(sub(b.position, a.position), sub(b.position, a.position)),
      ).toBe(1)
    },
  )

  it.each(FACES)(
    '%s: a clockwise turn really moves those stickers the way the words say',
    (face: Face) => {
      const guide = TURN_GUIDES[face]
      const middle = guide.cells[1]
      const landsAt = applyMove(NUMBERED, face).indexOf(middle)
      const moved = sub(STICKERS[landsAt].position, STICKERS[middle].position)
      expect(dot(moved, DIRECTION_VECTORS[guide.direction])).toBeGreaterThan(0)
      // …and the cells are listed in that same direction.
      const along = sub(
        STICKERS[guide.cells[2]].position,
        STICKERS[guide.cells[0]].position,
      )
      expect(dot(along, DIRECTION_VECTORS[guide.direction])).toBeGreaterThan(0)
    },
  )
})

describe('turnGuidesOf a 2x2', () => {
  const guides = turnGuidesOf(PUZZLE_2X2)
  const stickers = stickersOf(PUZZLE_2X2)
  const NUMBERED_2X2 = Array.from({ length: 24 }, (_, i) => i)

  it.each(FACES)(
    '%s: two stickers side by side on the same face, and in the same direction, as the 3x3',
    (face: Face) => {
      const guide = guides[face]
      expect(guide.cells).toHaveLength(2)
      expect(guide.face).toBe(TURN_GUIDES[face].face)
      expect(guide.direction).toBe(TURN_GUIDES[face].direction)
      const [a, b] = guide.cells.map((cell) => stickers[cell])
      for (const sticker of [a, b]) {
        expect(sticker.normal).toEqual(faceNormal(guide.face))
      }
      const step = sub(b.position, a.position)
      expect(dot(step, step)).toBe(1)
    },
  )

  it.each(FACES)(
    '%s: a clockwise turn really moves those stickers the way the words say',
    (face: Face) => {
      const guide = guides[face]
      const toward = DIRECTION_VECTORS[guide.direction]
      /**
       * The middle of a sticker's face. On a 2x2 every sticker is on a
       * corner, and the end one wraps round the edge, so where its cubie's
       * centre goes says less than where the sticker itself goes.
       */
      const surface = (cell: number) => {
        const { position, normal } = stickers[cell]
        return position.map((p, i) => p + normal[i] / 2)
      }
      for (const cell of guide.cells) {
        const landsAt = applyMove(NUMBERED_2X2, face).indexOf(cell)
        const moved = sub(surface(landsAt), surface(cell))
        expect(dot(moved, toward)).toBeGreaterThan(0)
      }
      const along = sub(
        stickers[guide.cells[1]].position,
        stickers[guide.cells[0]].position,
      )
      expect(dot(along, toward)).toBeGreaterThan(0)
    },
  )

  it('keeps the 3x3 guides as they were', () => {
    expect(turnGuidesOf(PUZZLE_3X3)).toBe(TURN_GUIDES)
  })
})
