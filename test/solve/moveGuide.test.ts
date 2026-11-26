import { describe, expect, it } from 'vitest'
import { faceNormal, STICKERS, stickersOf } from '../../src/cube/geometry.ts'
import {
  applyMove,
  movesOf,
  turnedLayers,
  type Move,
} from '../../src/cube/moves.ts'
import {
  PUZZLE_2X2,
  PUZZLE_3X3,
  PUZZLE_4X4,
  PUZZLE_5X5,
} from '../../src/cube/puzzle.ts'
import { cellIndex, FACES, type Face } from '../../src/cube/state.ts'
import {
  describeMove,
  layerGuideOf,
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

  it.each([
    ['Rw', 'Turn the right two layers clockwise (front stickers move up)'],
    [
      "Uw'",
      'Turn the top two layers anticlockwise (front stickers move right)',
    ],
    ['Fw2', 'Turn the front two layers twice (a half turn)'],
    [
      'r',
      'Turn only the second layer from the right clockwise (front stickers move up)',
    ],
    [
      "l'",
      'Turn only the second layer from the left anticlockwise (front stickers move up)',
    ],
    [
      'b',
      'Turn only the second layer from the back clockwise (top stickers move left)',
    ],
    ['d2', 'Turn only the second layer from the bottom twice (a half turn)'],
  ] as const)("a 4x4's %s → %s", (move, text) => {
    expect(describeMove(move)).toBe(text)
  })

  it.each(
    movesOf(PUZZLE_5X5).filter(
      (move) => /[a-z]/.test(move[0]) && !/^[xyz]/.test(move),
    ),
  )(
    "reads the same on a 5x5, where it's still true: %s turns the layers the words say",
    (move) => {
      const words = describeMove(move)
      const { layers } = turnedLayers(move, PUZZLE_5X5)
      expect(layers).toEqual([1])
      expect(words).toMatch(/^Turn only the second layer from the /)
    },
  )

  it.each(movesOf(PUZZLE_5X5).filter((move) => move[1] === 'w'))(
    'reads the same on a 5x5: %s turns the outer two of its five layers',
    (move) => {
      expect(turnedLayers(move, PUZZLE_5X5).layers).toEqual([0, 1])
      expect(describeMove(move)).toMatch(/^Turn the \w+ two layers /)
    },
  )
})

describe('turnedFace', () => {
  it('is the face a turn turns, alone or with the layer behind it', () => {
    expect(turnedFace("R'")).toBe('R')
    expect(turnedFace('Rw2')).toBe('R')
    expect(turnedFace('Dw')).toBe('D')
  })

  it('is none for an inner layer on its own, which turns no face', () => {
    expect(turnedFace('r')).toBeNull()
    expect(turnedFace("u'")).toBeNull()
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

describe.each([PUZZLE_4X4, PUZZLE_5X5])('layerGuideOf a $name', (puzzle) => {
  const stickers = stickersOf(puzzle)
  const NUMBERED = Array.from({ length: puzzle.cellCount }, (_, i) => i)
  const TURNS = movesOf(puzzle).filter(
    (move) => !/^[xyz]/.test(move) && !move.endsWith('2'),
  )
  /** Where a sticker's face is: the end ones of a line wrap round an edge. */
  const surface = (cell: number) => {
    const { position, normal } = stickers[cell]
    return position.map((p, i) => p + normal[i] / 2)
  }

  it.each(TURNS)(
    '%s: a whole row or column of stickers on the front or top face for each layer it turns, each moving the way the words say',
    (move: Move) => {
      const guide = layerGuideOf(move, puzzle)
      const layers = move.includes('w') ? 2 : 1
      expect(guide.lines).toHaveLength(layers)
      const toward = DIRECTION_VECTORS[guide.direction]
      const sign = move.endsWith("'") ? -1 : 1
      const after = applyMove(NUMBERED, move)
      for (const line of guide.lines) {
        expect(line).toHaveLength(puzzle.size)
        for (const cell of line) {
          expect(stickers[cell].normal).toEqual(faceNormal(guide.face))
          const moved = sub(surface(after.indexOf(cell)), surface(cell))
          expect(sign * dot(moved, toward)).toBeGreaterThan(0)
        }
      }
    },
  )

  it("puts an inner layer's line one in from the face's: r is the front's second column from the right", () => {
    const { size } = puzzle
    const last = size - 1
    /** Column c of the front, from the bottom up: the way R moves it. */
    const column = (c: number) =>
      Array.from({ length: size }, (_, i) =>
        cellIndex('F', (last - i) * size + c, puzzle),
      )
    expect(layerGuideOf('r', puzzle).lines).toEqual([column(last - 1)])
    expect(layerGuideOf('R', puzzle).lines).toEqual([column(last)])
    expect(layerGuideOf('Rw', puzzle).lines).toEqual([
      column(last),
      column(last - 1),
    ])
  })

  it('refuses a whole-cube turn', () => {
    expect(() => layerGuideOf('x', puzzle)).toThrow()
  })
})

describe('layerGuideOf', () => {
  it('matches turnGuidesOf for a face turn, on every cube', () => {
    for (const puzzle of [PUZZLE_2X2, PUZZLE_3X3, PUZZLE_4X4, PUZZLE_5X5]) {
      for (const face of FACES) {
        const guide = turnGuidesOf(puzzle)[face]
        expect(layerGuideOf(face, puzzle)).toEqual({
          face: guide.face,
          direction: guide.direction,
          lines: [guide.cells],
        })
      }
    }
  })
})
