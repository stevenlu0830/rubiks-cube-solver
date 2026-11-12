import { describe, expect, it } from 'vitest'
import { applyMoves, parseMoves } from '../../src/cube/moves.ts'
import { PUZZLE_2X2, puzzleOf } from '../../src/cube/puzzle.ts'
import {
  cellIndex,
  FACES,
  solvedState,
  STANDARD_SCHEME,
  type Color,
  type CubeState,
  type Face,
} from '../../src/cube/state.ts'
import type { Classified } from '../../src/scan/classify.ts'
import type { ScannedSides } from '../../src/scan/sides.ts'
import {
  findTurnedSides,
  turnCells,
  turnSides,
  type SideTurns,
} from '../../src/scan/turnedSides.ts'

const SCRAMBLED = applyMoves(
  solvedState(),
  parseMoves("R U2 F' L D B2 R' U F2 L'"),
)

const faceCells = (face: Face, puzzle = puzzleOf(SCRAMBLED)) =>
  Array.from({ length: puzzle.cellsPerFace }, (_, n) =>
    cellIndex(face, n, puzzle),
  )

/**
 * A scan of `cube` with each side's photo in its usual place, except the
 * sides in `turned`: their real side was held turned that many quarter
 * turns clockwise, so each square of the photo shows a different square.
 * Returns the sides, and the colours named for them.
 */
function scan(cube: CubeState, turned: SideTurns = {}) {
  const sides: ScannedSides = {}
  const named = new Map<number, Classified>()
  for (const face of FACES) {
    const cells = faceCells(face, puzzleOf(cube))
    const shows = turnCells(cells, turned[face] ?? 0)
    sides[face] = { cells, rgb: [], readings: [] }
    cells.forEach((cell, n) =>
      named.set(cell, { color: cube[shows[n]]!, unsure: false }),
    )
  }
  return { sides, named }
}

/** The cube a scan paints: each photo's colours on its cells. */
function painted(sides: ScannedSides, named: Map<number, Classified>) {
  const cube = Array<Color | null>(named.size).fill(null)
  for (const face of FACES) {
    for (const cell of sides[face]!.cells) cube[cell] = named.get(cell)!.color
  }
  return cube
}

describe('turnCells', () => {
  it('turns a photo a quarter turn clockwise', () => {
    // Its top left shows what was the bottom left, its top right the top left…
    expect(turnCells([0, 1, 2, 3, 4, 5, 6, 7, 8], 1)).toEqual([
      6, 3, 0, 7, 4, 1, 8, 5, 2,
    ])
  })

  it('comes back round after four', () => {
    const cells = faceCells('R')
    expect(turnCells(cells, 4)).toEqual(cells)
    expect(turnCells(turnCells(cells, 1), 3)).toEqual(cells)
    expect(turnCells(cells, 2)).toEqual([...cells].reverse())
  })
})

describe('findTurnedSides', () => {
  it('finds nothing to fix in a cube scanned right', () => {
    const { sides, named } = scan(SCRAMBLED)
    expect(findTurnedSides(sides, named)).toBeNull()
  })

  it.each(
    FACES.flatMap((face) => [1, 2, 3].map((turns) => [face, turns] as const)),
  )('finds side %s photographed %i quarter turn(s) round', (face, turns) => {
    const { sides, named } = scan(SCRAMBLED, { [face]: turns })
    expect(findTurnedSides(sides, named)).toEqual({ [face]: turns })
  })

  it('finds two sides turned at once', () => {
    const { sides, named } = scan(SCRAMBLED, { U: 1, B: 2 })
    expect(findTurnedSides(sides, named)).toEqual({ U: 1, B: 2 })
  })

  it('goes for the answer that turns the fewest sides', () => {
    // Turning all six sides happens to give a real cube too, but holding one
    // side wrong is a far likelier slip.
    const cube = applyMoves(solvedState(), parseMoves("R' F' D"))
    const { sides, named } = scan(cube, { D: 1 })
    expect(findTurnedSides(sides, named)).toEqual({ D: 1 })
  })

  it("can't tell when two different answers turn just as few sides", () => {
    // In this very regular pattern, turning the left side or the right side
    // both give a cube that could be real.
    const cube = applyMoves(solvedState(), parseMoves("L2 R2 z'"))
    const { sides, named } = scan(cube, { L: 3 })
    expect(findTurnedSides(sides, named)).toBeNull()
  })

  it('leaves alone a cube that is wrong some other way', () => {
    // A square the wrong colour: no way of turning can fix that.
    const { sides, named } = scan(SCRAMBLED, { R: 1 })
    named.set(cellIndex('F', 0), { color: 'white', unsure: false })
    expect(findTurnedSides(sides, named)).toBeNull()
  })

  it('waits for all six sides', () => {
    const { sides, named } = scan(SCRAMBLED, { R: 1 })
    delete sides.D
    expect(findTurnedSides(sides, named)).toBeNull()
  })

  it('is quick enough to run after every photo', () => {
    // The worst case: one side with a twisted corner, so all 4,096 ways fail.
    const { sides, named } = scan(SCRAMBLED)
    const twisted = scan(SCRAMBLED)
    const corner = [cellIndex('U', 8), cellIndex('R', 0), cellIndex('F', 2)]
    const colors = corner.map((cell) => named.get(cell)!.color)
    corner.forEach((cell, i) =>
      twisted.named.set(cell, { color: colors[(i + 1) % 3], unsure: false }),
    )
    const start = performance.now()
    expect(findTurnedSides(sides, twisted.named)).toBeNull()
    expect(performance.now() - start).toBeLessThan(250)
  })
})

describe('turnSides', () => {
  it('puts the colours of a turned side back where they belong', () => {
    const { sides, named } = scan(SCRAMBLED, { L: 3 })
    const turns = findTurnedSides(sides, named)!
    const turned = turnSides(sides, {}, turns)
    // Each photo square keeps its colour, but now goes on the right cell.
    const renamed = new Map<number, Classified>()
    for (const face of FACES) {
      sides[face]!.cells.forEach((cell, n) =>
        renamed.set(turned.sides[face]!.cells[n], named.get(cell)!),
      )
    }
    expect(painted(turned.sides, renamed)).toEqual(SCRAMBLED)
  })

  it('moves colours picked by hand with their squares', () => {
    const { sides } = scan(SCRAMBLED)
    const [topLeft, top] = faceCells('F')
    const turned = turnSides(
      sides,
      { [topLeft]: 'red', [top]: 'blue' },
      {
        F: 1,
      },
    )
    // Turned clockwise, the photo's top left shows the side's bottom left,
    // and its top shows the left.
    expect(turned.fixes).toEqual({
      [cellIndex('F', 6)]: 'red',
      [cellIndex('F', 3)]: 'blue',
    })
    expect(turned.sides.R).toBe(sides.R) // other sides untouched
  })
})

describe('on a 2x2', () => {
  const SCRAMBLED_2X2 = applyMoves(
    solvedState(STANDARD_SCHEME, PUZZLE_2X2),
    parseMoves("R U2 F' L D B2 R' U F2"),
  )

  it('turns a photo of 4 squares a quarter turn clockwise', () => {
    // The top left shows what was the bottom left, the top right the top left…
    expect(turnCells([0, 1, 2, 3], 1)).toEqual([2, 0, 3, 1])
    expect(turnCells([0, 1, 2, 3], 2)).toEqual([3, 2, 1, 0])
    expect(turnCells([0, 1, 2, 3], 4)).toEqual([0, 1, 2, 3])
  })

  it('finds nothing to fix in a 2x2 scanned right', () => {
    const { sides, named } = scan(SCRAMBLED_2X2)
    expect(findTurnedSides(sides, named)).toBeNull()
  })

  it.each(
    FACES.flatMap((face) => [1, 2, 3].map((turns) => [face, turns] as const)),
  )(
    'finds side %s of a 2x2 photographed %i quarter turn(s) round, and turns it back',
    (face, turns) => {
      const { sides, named } = scan(SCRAMBLED_2X2, { [face]: turns })
      const found = findTurnedSides(sides, named)
      expect(found).toEqual({ [face]: turns })

      const turned = turnSides(sides, {}, found!)
      const renamed = new Map<number, Classified>()
      for (const side of FACES) {
        sides[side]!.cells.forEach((cell, n) =>
          renamed.set(turned.sides[side]!.cells[n], named.get(cell)!),
        )
      }
      expect(painted(turned.sides, renamed)).toEqual(SCRAMBLED_2X2)
    },
  )
})
