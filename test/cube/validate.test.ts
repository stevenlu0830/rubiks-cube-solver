import { describe, expect, it } from 'vitest'
import { seededRandom } from '../helpers/seededRandom.ts'
import {
  CORNER_CELLS,
  cornerCellsOf,
  EDGE_CELLS,
  fromCubies,
  solvedCubies,
  type CubieCube,
} from '../../src/cube/cubies.ts'
import {
  applyMoves,
  MOVES,
  parseMoves,
  randomScramble,
} from '../../src/cube/moves.ts'
import { PUZZLE_2X2 } from '../../src/cube/puzzle.ts'
import {
  CENTER,
  cellIndex,
  emptyState,
  solvedState,
  STANDARD_SCHEME,
  type ColorScheme,
  type CubeState,
} from '../../src/cube/state.ts'
import { validateCube, type Problem } from '../../src/cube/validate.ts'

const scrambled = (seed: number, scheme?: ColorScheme) =>
  applyMoves(solvedState(scheme), randomScramble(25, seededRandom(seed)))

/** A copy of `cube` with the colours of cells a and b exchanged. */
const swapCells = (cube: CubeState, a: number, b: number) => {
  const next = [...cube]
  next[a] = cube[b]
  next[b] = cube[a]
  return next
}

/** A cube painted from pieces: solved, except for the given changes. */
const fromPieces = (changes: Partial<CubieCube>) =>
  fromCubies({ ...solvedCubies(), ...changes }, STANDARD_SCHEME)

const swapped = (values: number[], i: number, j: number) => {
  const next = [...values]
  next[i] = values[j]
  next[j] = values[i]
  return next
}

/** Checks the cube fails with `problem`, and returns the failure for further checks. */
function expectProblem(cube: CubeState, problem: Problem) {
  const result = validateCube(cube)
  if (result.valid)
    throw new Error(`expected "${problem}", but the cube passed`)
  expect(result.problem).toBe(problem)
  return { ...result, cells: result.cells.toSorted((a, b) => a - b) }
}

const sorted = (cells: number[]) => cells.toSorted((a, b) => a - b)

describe('valid cubes pass every check', () => {
  it('reports a solved cube as already solved', () => {
    expect(validateCube(solvedState())).toEqual({ valid: true, solved: true })
  })

  it('still sees a solved cube as solved when it was painted turned round', () => {
    const turned = applyMoves(solvedState(), parseMoves('x y2 z'))
    expect(validateCube(turned)).toEqual({ valid: true, solved: true })
  })

  it('passes 100 scrambled cubes as valid but not solved', () => {
    for (let seed = 1; seed <= 100; seed++) {
      expect(validateCube(scrambled(seed))).toEqual({
        valid: true,
        solved: false,
      })
    }
  })

  it('accepts any colour scheme, because the centres decide which face is which', () => {
    const scheme: ColorScheme = {
      U: 'white',
      D: 'blue',
      F: 'red',
      B: 'orange',
      R: 'green',
      L: 'yellow',
    }
    expect(validateCube(scrambled(1, scheme))).toEqual({
      valid: true,
      solved: false,
    })
  })

  it('accepts two swapped corners plus two swapped edges, which a real cube can reach', () => {
    const cube = fromPieces({
      cp: swapped(solvedCubies().cp, 0, 1),
      ep: swapped(solvedCubies().ep, 0, 1),
    })
    expect(validateCube(cube)).toEqual({ valid: true, solved: false })
  })
})

describe('1. every square painted', () => {
  it('points at the one blank square', () => {
    const cube = [...scrambled(1)]
    cube[30] = null
    const result = expectProblem(cube, 'unpainted')
    expect(result.cells).toEqual([30])
    expect(result.message).toContain('1 square is still blank')
  })

  it('points at all 54 squares of a blank cube', () => {
    const result = expectProblem(emptyState(), 'unpainted')
    expect(result.cells).toHaveLength(54)
    expect(result.message).toContain('54 squares are still blank')
  })
})

describe('2. nine squares of each colour', () => {
  it('names the wrong counts and highlights the colour with too many', () => {
    const cube = [...solvedState()]
    cube[0] = 'red' // a white square painted red
    const result = expectProblem(cube, 'color-count')
    expect(result.message).toContain('white has 8')
    expect(result.message).toContain('red has 10')
    expect(result.cells).toHaveLength(10)
    expect(result.cells.every((cell) => cube[cell] === 'red')).toBe(true)
  })
})

describe('3. six different centres', () => {
  it('highlights two centres of the same colour', () => {
    const upCenter = cellIndex('U', CENTER)
    const rightCenter = cellIndex('R', CENTER)
    // Swap the white top centre with a red square: counts stay at 9 each.
    const cube = swapCells(solvedState(), upCenter, cellIndex('R', 0))
    const result = expectProblem(cube, 'centers')
    expect(result.cells).toEqual([upCenter, rightCenter])
    expect(result.message).toContain('More than one centre is red')
  })
})

describe('4. every edge real, and each one once', () => {
  it('catches an edge with the same colour on both sides', () => {
    const [ufTop] = EDGE_CELLS[1] // UF edge's white square
    const [, urSide] = EDGE_CELLS[0] // UR edge's red square
    const result = expectProblem(
      swapCells(solvedState(), ufTop, urSide),
      'edges',
    )
    expect(result.message).toContain('An edge is white on both sides')
    expect(result.cells).toEqual(sorted(EDGE_CELLS[0]))
  })

  it('catches edges with colours from opposite faces', () => {
    const [ufTop] = EDGE_CELLS[1] // white
    const [, dbBack] = EDGE_CELLS[7] // blue
    const result = expectProblem(
      swapCells(solvedState(), ufTop, dbBack),
      'edges',
    )
    expect(result.message).toContain('opposite sides')
    expect(result.message).toContain('2 edges have problems')
    expect(result.cells).toEqual(sorted([...EDGE_CELLS[1], ...EDGE_CELLS[7]]))
  })

  it('catches an edge that appears twice', () => {
    const ep = solvedCubies().ep
    ep[1] = 5 // the UF slot shows the DF edge…
    ep[7] = 3 // …and the DB slot shows the UB edge
    const result = expectProblem(fromPieces({ ep }), 'edges')
    expect(result.message).toContain('appears more than once')
    expect(result.cells).toEqual(
      sorted([1, 3, 5, 7].flatMap((slot) => EDGE_CELLS[slot])),
    )
  })
})

describe('5. every corner real, in clockwise order, and each one once', () => {
  it('catches a corner whose colours are in mirror-image order', () => {
    const [, urfRight, urfFront] = CORNER_CELLS[0]
    const result = expectProblem(
      swapCells(solvedState(), urfRight, urfFront),
      'corners',
    )
    expect(result.message).toContain('mirror-image')
    expect(result.cells).toEqual(sorted(CORNER_CELLS[0]))
  })

  it('catches corners with opposite colours or a colour twice', () => {
    const [, , urfFront] = CORNER_CELLS[0] // green
    const [dlfDown] = CORNER_CELLS[5] // yellow
    const result = expectProblem(
      swapCells(solvedState(), urfFront, dlfDown),
      'corners',
    )
    expect(result.message).toContain('opposite sides') // URF is now white, red and yellow
    expect(result.message).toContain('2 corners have problems') // DLF is now green twice
    expect(result.cells).toEqual(
      sorted([...CORNER_CELLS[0], ...CORNER_CELLS[5]]),
    )
  })

  it('catches a corner that appears twice', () => {
    const result = expectProblem(
      fromPieces({ cp: [0, 1, 2, 0, 4, 6, 6, 7] }),
      'corners',
    )
    expect(result.message).toContain('appears more than once')
    expect(result.cells).toEqual(
      sorted([0, 3, 5, 6].flatMap((slot) => CORNER_CELLS[slot])),
    )
  })
})

describe('6. corner twists add up', () => {
  it('catches one twisted corner and highlights all corners', () => {
    const co = solvedCubies().co
    co[0] = 1
    const result = expectProblem(fromPieces({ co }), 'twist')
    expect(result.message).toContain('A corner is twisted')
    expect(result.cells).toEqual(sorted(CORNER_CELLS.flat()))
  })
})

describe('7. edge flips add up', () => {
  it('catches one flipped edge and highlights all edges', () => {
    const eo = solvedCubies().eo
    eo[1] = 1
    const result = expectProblem(fromPieces({ eo }), 'flip')
    expect(result.message).toContain('An edge is flipped')
    expect(result.cells).toEqual(sorted(EDGE_CELLS.flat()))
  })
})

describe('8. corner and edge swaps match', () => {
  it('catches two swapped edges', () => {
    const result = expectProblem(
      fromPieces({ ep: swapped(solvedCubies().ep, 0, 1) }),
      'swap',
    )
    expect(result.message).toContain('Two pieces seem to have swapped places')
    expect(result.cells).toEqual([])
  })

  it('catches two swapped corners', () => {
    expectProblem(fromPieces({ cp: swapped(solvedCubies().cp, 0, 1) }), 'swap')
  })
})

describe('check order', () => {
  it('reports the earliest problem first', () => {
    const co = solvedCubies().co
    const eo = solvedCubies().eo
    co[0] = 1
    eo[0] = 1
    expectProblem(fromPieces({ co, eo }), 'twist') // twist (6) before flip (7)

    const cube = [...solvedState()]
    cube[0] = 'red'
    cube[1] = null
    expectProblem(cube, 'unpainted') // blank (1) before colour counts (2)
  })
})

describe('a 2x2', () => {
  const SOLVED_2X2 = solvedState(STANDARD_SCHEME, PUZZLE_2X2)
  const CORNERS_2X2 = cornerCellsOf(PUZZLE_2X2)
  const scrambled2x2 = (seed: number) =>
    applyMoves(SOLVED_2X2, randomScramble(20, seededRandom(seed)))
  /**
   * A 2x2 is a 3x3's corners: builds one from 3x3 pieces (see fromPieces),
   * keeping the corner squares. The 2x2 cell at (row, column) of a face is
   * the 3x3 cell at (2 × row, 2 × column).
   */
  const twoByTwoFromPieces = (changes: Partial<CubieCube>) => {
    const threeByThree = fromPieces(changes)
    return Array.from({ length: 24 }, (_, cell) => {
      const face = Math.floor(cell / 4)
      const [row, column] = [Math.floor((cell % 4) / 2), cell % 2]
      return threeByThree[face * 9 + row * 6 + column * 2]
    })
  }

  it('reports a solved 2x2 as already solved, whichever way it was painted', () => {
    expect(validateCube(SOLVED_2X2)).toEqual({ valid: true, solved: true })
    expect(validateCube(applyMoves(SOLVED_2X2, parseMoves('x y2 z')))).toEqual({
      valid: true,
      solved: true,
    })
  })

  it('passes 100 scrambled 2x2s as valid, held any of the 24 ways', () => {
    const turns = MOVES.filter((move) => /^[xyz]/.test(move))
    const random = seededRandom(77)
    for (let seed = 1; seed <= 100; seed++) {
      const held = applyMoves(scrambled2x2(seed), [
        turns[Math.floor(random() * turns.length)],
        turns[Math.floor(random() * turns.length)],
      ])
      expect(validateCube(held)).toEqual({ valid: true, solved: false })
    }
  })

  it('accepts any two corners swapped: with no edges, a 2x2 can reach that', () => {
    const cube = twoByTwoFromPieces({ cp: [1, 0, 2, 3, 4, 5, 6, 7] })
    expect(validateCube(cube)).toEqual({ valid: true, solved: false })
  })

  it('asks for all 24 squares to be painted', () => {
    const result = expectProblem(emptyState(PUZZLE_2X2), 'unpainted')
    expect(result.cells).toHaveLength(24)
    expect(result.message).toBe(
      '24 squares are still blank. Paint all 24 to match your cube.',
    )
  })

  it('asks for exactly 4 squares of each colour', () => {
    const cube = [...SOLVED_2X2]
    cube[0] = 'red' // a white square painted red
    const result = expectProblem(cube, 'color-count')
    expect(result.message).toBe(
      'Each colour needs exactly 4 squares, but white has 3 and red has 5.',
    )
    expect(result.cells).toHaveLength(5)
  })

  it('catches a corner whose colours are in mirror-image order', () => {
    const [, urfRight, urfFront] = CORNERS_2X2[0]
    const result = expectProblem(
      swapCells(SOLVED_2X2, urfRight, urfFront),
      'corners',
    )
    expect(result.message).toContain('mirror-image')
    expect(result.cells).toEqual(sorted(CORNERS_2X2[0]))
  })

  it('catches corners with opposite colours or a colour twice', () => {
    const [, , urfFront] = CORNERS_2X2[0] // green
    const [dlfDown] = CORNERS_2X2[5] // yellow
    const result = expectProblem(
      swapCells(SOLVED_2X2, urfFront, dlfDown),
      'corners',
    )
    expect(result.message).toContain('opposite sides') // URF: white, red and yellow
    expect(result.message).toContain('2 corners have problems') // DLF: green twice
  })

  it('catches a corner that appears twice', () => {
    const result = expectProblem(
      twoByTwoFromPieces({ cp: [0, 1, 2, 0, 4, 6, 6, 7] }),
      'corners',
    )
    expect(result.message).toBe(
      'The white–red–green corner appears more than once, so another corner is missing. Check the highlighted corners.',
    )
    expect(result.cells).toEqual(
      sorted([0, 3, 5, 6].flatMap((slot) => CORNERS_2X2[slot])),
    )
  })

  it('catches one twisted corner, held any way, and highlights all corners', () => {
    const co = solvedCubies().co
    co[0] = 1
    const twisted = twoByTwoFromPieces({ co })
    for (const turns of ['', 'x', 'y', 'z', "x2 y'", "z' x"]) {
      const result = expectProblem(
        applyMoves(twisted, parseMoves(turns)),
        'twist',
      )
      expect(result.message).toContain('A corner is twisted')
      expect(result.cells).toEqual(
        Array.from({ length: 24 }, (_, cell) => cell),
      )
    }
  })
})
