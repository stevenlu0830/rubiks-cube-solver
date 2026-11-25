import { describe, expect, it } from 'vitest'
import { seededRandom } from '../helpers/seededRandom.ts'
import {
  centreRingsOf,
  CORNER_CELLS,
  cornerCellsOf,
  EDGE_CELLS,
  edgeCellsOf,
  EDGES,
  fromCubies,
  solvedCubies,
  WING_CELLS,
  wingCellsOf,
  type CubieCube,
} from '../../src/cube/cubies.ts'
import {
  applyMoves,
  MOVES,
  movesOf,
  parseMoves,
  randomScramble,
} from '../../src/cube/moves.ts'
import { PUZZLE_2X2, PUZZLE_4X4, PUZZLE_5X5 } from '../../src/cube/puzzle.ts'
import { FLIP_FIX, SWAP_FIX } from '../../src/solver/fourByFour.ts'
import {
  centerCell,
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
    const upCenter = centerCell('U')
    const rightCenter = centerCell('R')
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

describe('a 4x4', () => {
  const SOLVED_4X4 = solvedState(STANDARD_SCHEME, PUZZLE_4X4)
  const CORNERS_4X4 = cornerCellsOf(PUZZLE_4X4)
  const TURNS = movesOf(PUZZLE_4X4).filter((move) => !/^[xyz]/.test(move))
  const scrambled4x4 = (seed: number) => {
    const random = seededRandom(seed)
    return applyMoves(
      SOLVED_4X4,
      Array.from(
        { length: 60 },
        () => TURNS[Math.floor(random() * TURNS.length)],
      ),
    )
  }

  it('reports a solved 4x4 as already solved, whichever way it was painted', () => {
    expect(validateCube(SOLVED_4X4)).toEqual({ valid: true, solved: true })
    expect(validateCube(applyMoves(SOLVED_4X4, parseMoves("x y2 z'")))).toEqual(
      { valid: true, solved: true },
    )
  })

  it('passes 100 scrambled 4x4s as valid, held any of the 24 ways', () => {
    const turns = MOVES.filter((move) => /^[xyz]/.test(move))
    const random = seededRandom(78)
    for (let seed = 1; seed <= 100; seed++) {
      const held = applyMoves(scrambled4x4(seed), [
        turns[Math.floor(random() * turns.length)],
        turns[Math.floor(random() * turns.length)],
      ])
      expect(validateCube(held)).toEqual({ valid: true, solved: false })
    }
  })

  it("accepts the cases a 3x3 can't have, a flipped edge or two swapped pieces: turning a 4x4 can reach them", () => {
    for (const moves of [
      FLIP_FIX,
      SWAP_FIX,
      parseMoves('r'),
      parseMoves("u f'"),
    ]) {
      expect(validateCube(applyMoves(SOLVED_4X4, moves))).toEqual({
        valid: true,
        solved: false,
      })
    }
  })

  it('asks for all 96 squares to be painted', () => {
    const result = expectProblem(emptyState(PUZZLE_4X4), 'unpainted')
    expect(result.cells).toHaveLength(96)
    expect(result.message).toBe(
      '96 squares are still blank. Paint all 96 to match your cube.',
    )
  })

  it('asks for exactly 16 squares of each colour', () => {
    const cube = [...SOLVED_4X4]
    cube[5] = 'blue' // a white centre painted blue
    const result = expectProblem(cube, 'color-count')
    expect(result.message).toBe(
      'Each colour needs exactly 16 squares, but white has 15 and blue has 17.',
    )
    expect(result.cells).toHaveLength(17)
  })

  /** The cell of an edge piece (see WING_CELLS) that's this colour on a solved cube. */
  const cellOf = (piece: number, color: string) =>
    WING_CELLS[piece].find((cell) => SOLVED_4X4[cell] === color)!
  const UF = 2 * EDGES.indexOf('UF')

  it('catches an edge piece with the same colour on both sides', () => {
    // White–green's green swapped with white–red's white: white–green
    // becomes white twice (white–red becomes green–red, a real piece).
    const UR = 2 * EDGES.indexOf('UR')
    const result = expectProblem(
      swapCells(SOLVED_4X4, cellOf(UF, 'green'), cellOf(UR, 'white')),
      'edges',
    )
    expect(result.message).toBe(
      "An edge piece is white on both sides, so it can't exist.",
    )
    expect(result.cells).toEqual(sorted([...WING_CELLS[UF]]))
  })

  it('catches edge pieces with colours from opposite faces, or one colour twice', () => {
    // White–green's green swapped with yellow–green's yellow.
    const DF = 2 * EDGES.indexOf('DF')
    const result = expectProblem(
      swapCells(SOLVED_4X4, cellOf(UF, 'green'), cellOf(DF, 'yellow')),
      'edges',
    )
    expect(result.message).toMatch(
      /^An edge piece has (white and yellow|yellow and white), which are on opposite sides of the cube, so it can't exist\. \(2 edge pieces have problems; all are highlighted\.\)$/,
    )
    expect(result.cells).toEqual(sorted([...WING_CELLS[UF], ...WING_CELLS[DF]]))
  })

  it('catches an edge piece painted the wrong way round, as its mirror-image twin appearing twice', () => {
    const [first, second] = WING_CELLS[UF]
    const result = expectProblem(swapCells(SOLVED_4X4, first, second), 'edges')
    expect(result.message).toBe(
      "There are two of the same white–green edge piece. A 4x4's two white–green edge pieces are mirror images, so one of these is probably painted the wrong way round. Check the highlighted edge pieces.",
    )
    expect(result.cells).toEqual(
      sorted([...WING_CELLS[UF], ...WING_CELLS[UF + 1]]),
    )
  })

  it('catches an edge piece that appears more than twice, so another is missing', () => {
    // Both white–red pieces painted as copies of the first white–green one:
    // three of it. The colours are made up elsewhere, to keep 16 of each.
    const cube = [...SOLVED_4X4]
    const UR = 2 * EDGES.indexOf('UR')
    for (const piece of [UR, UR + 1]) {
      WING_CELLS[piece].forEach((cell, i) => {
        cube[cell] = SOLVED_4X4[WING_CELLS[UF][i]]
      })
    }
    cube[cellOf(UF + 1, 'green')] = 'red'
    cube[cellIndex('F', 5, PUZZLE_4X4)] = 'red' // a green centre
    const result = expectProblem(cube, 'edges')
    expect(result.message).toBe(
      'The white–green edge piece appears more than once, so another edge piece is missing. Check the highlighted edge pieces.',
    )
    expect(result.cells).toEqual(
      sorted([...WING_CELLS[UF], ...WING_CELLS[UR], ...WING_CELLS[UR + 1]]),
    )
  })

  it('catches a corner whose colours are in mirror-image order', () => {
    const [, urfRight, urfFront] = CORNERS_4X4[0]
    const result = expectProblem(
      swapCells(SOLVED_4X4, urfRight, urfFront),
      'corners',
    )
    expect(result.message).toContain('mirror-image')
    expect(result.cells).toEqual(sorted(CORNERS_4X4[0]))
  })

  it('catches one twisted corner, held any way, and highlights all corners', () => {
    const [up, right, front] = CORNERS_4X4[0]
    const twisted = [...SOLVED_4X4]
    twisted[up] = SOLVED_4X4[front]
    twisted[right] = SOLVED_4X4[up]
    twisted[front] = SOLVED_4X4[right]
    for (const turns of ['', 'x', "y2 z'"]) {
      const result = expectProblem(
        applyMoves(twisted, parseMoves(turns)),
        'twist',
      )
      expect(result.message).toContain('A corner is twisted')
      expect(result.cells).toHaveLength(24)
    }
  })
})

describe('a 5x5', () => {
  const SOLVED_5X5 = solvedState(STANDARD_SCHEME, PUZZLE_5X5)
  const CORNERS_5X5 = cornerCellsOf(PUZZLE_5X5)
  const MIDDLE_EDGES = edgeCellsOf(PUZZLE_5X5)
  const OUTER_EDGES = wingCellsOf(PUZZLE_5X5)
  const ringOf = (kind: 'corner' | 'edge') =>
    centreRingsOf(PUZZLE_5X5).find((ring) => ring.kind === kind)!.cells
  const TURNS = movesOf(PUZZLE_5X5).filter((move) => !/^[xyz]/.test(move))
  const scrambled5x5 = (seed: number) => {
    const random = seededRandom(seed)
    return applyMoves(
      SOLVED_5X5,
      Array.from(
        { length: 60 },
        () => TURNS[Math.floor(random() * TURNS.length)],
      ),
    )
  }
  /** Exchanges two pieces, sticker for sticker, so each arrives the same way round. */
  const swapPieces = (
    cube: CubeState,
    a: readonly number[],
    b: readonly number[],
  ) => {
    const next = [...cube]
    a.forEach((cell, i) => {
      next[cell] = cube[b[i]]
      next[b[i]] = cube[cell]
    })
    return next
  }
  const UF = EDGES.indexOf('UF')
  const UR = EDGES.indexOf('UR')
  /** The cell of a piece that's this colour on a solved cube. */
  const cellOf = (cells: readonly number[], color: string) =>
    cells.find((cell) => SOLVED_5X5[cell] === color)!

  it('reports a solved 5x5 as already solved, whichever way it was painted', () => {
    expect(validateCube(SOLVED_5X5)).toEqual({ valid: true, solved: true })
    expect(validateCube(applyMoves(SOLVED_5X5, parseMoves("x y2 z'")))).toEqual(
      { valid: true, solved: true },
    )
  })

  it('passes 100 scrambled 5x5s as valid, held any of the 24 ways', () => {
    const turns = MOVES.filter((move) => /^[xyz]/.test(move))
    const random = seededRandom(79)
    for (let seed = 1; seed <= 100; seed++) {
      const held = applyMoves(scrambled5x5(seed), [
        turns[Math.floor(random() * turns.length)],
        turns[Math.floor(random() * turns.length)],
      ])
      expect(validateCube(held)).toEqual({ valid: true, solved: false })
    }
  })

  it('accepts any colour scheme, because the centres decide which face is which', () => {
    const scheme: ColorScheme = {
      U: 'blue',
      R: 'white',
      F: 'red',
      D: 'green',
      L: 'yellow',
      B: 'orange',
    }
    const moves = parseMoves("R u' Fw2 l D2 b'")
    expect(validateCube(solvedState(scheme, PUZZLE_5X5))).toEqual({
      valid: true,
      solved: true,
    })
    expect(
      validateCube(applyMoves(solvedState(scheme, PUZZLE_5X5), moves)),
    ).toEqual({ valid: true, solved: false })
  })

  it("accepts an edge's two outer pieces swapped, which turning a 5x5 can reach though a 3x3 has nothing like it", () => {
    const cube = swapPieces(
      SOLVED_5X5,
      OUTER_EDGES[2 * UF],
      OUTER_EDGES[2 * UF + 1],
    )
    expect(validateCube(cube)).toEqual({ valid: true, solved: false })
  })

  it('accepts the squares round the centres in any arrangement with 4 of each colour in each ring', () => {
    // A white and a red square diagonally next to their centres swapped.
    const diagonal = ringOf('corner')
    const white = diagonal.find((cell) => SOLVED_5X5[cell] === 'white')!
    const red = diagonal.find((cell) => SOLVED_5X5[cell] === 'red')!
    expect(validateCube(swapCells(SOLVED_5X5, white, red))).toEqual({
      valid: true,
      solved: false,
    })
  })

  it('accepts two swapped corners plus two swapped middle edge pieces, which a real cube can reach', () => {
    const cube = swapPieces(
      swapPieces(SOLVED_5X5, CORNERS_5X5[0], CORNERS_5X5[1]),
      MIDDLE_EDGES[0],
      MIDDLE_EDGES[1],
    )
    expect(validateCube(cube)).toEqual({ valid: true, solved: false })
  })

  it('asks for all 150 squares to be painted', () => {
    const result = expectProblem(emptyState(PUZZLE_5X5), 'unpainted')
    expect(result.cells).toHaveLength(150)
    expect(result.message).toBe(
      '150 squares are still blank. Paint all 150 to match your cube.',
    )
  })

  it('asks for exactly 25 squares of each colour', () => {
    const cube = [...SOLVED_5X5]
    cube[0] = 'blue' // a white corner square painted blue
    const result = expectProblem(cube, 'color-count')
    expect(result.message).toBe(
      'Each colour needs exactly 25 squares, but white has 24 and blue has 26.',
    )
    expect(result.cells).toHaveLength(26)
  })

  it('asks for six different centres, the middle square of each face', () => {
    const upCenter = centerCell('U', PUZZLE_5X5)
    const rightCenter = centerCell('R', PUZZLE_5X5)
    // The white centre swapped with a red square: still 25 of each.
    const cube = swapCells(SOLVED_5X5, upCenter, cellIndex('R', 0, PUZZLE_5X5))
    const result = expectProblem(cube, 'centers')
    expect(result.message).toBe(
      'More than one centre is red. The six centres must all be different colours.',
    )
    expect(result.cells).toEqual(sorted([upCenter, rightCenter]))
  })

  it('catches a middle edge piece with the same colour on both sides', () => {
    // White–green's green swapped with white–red's white.
    const result = expectProblem(
      swapCells(
        SOLVED_5X5,
        cellOf(MIDDLE_EDGES[UF], 'green'),
        cellOf(MIDDLE_EDGES[UR], 'white'),
      ),
      'edges',
    )
    expect(result.message).toBe(
      "A middle edge piece is white on both sides, so it can't exist.",
    )
    expect(result.cells).toEqual(sorted(MIDDLE_EDGES[UF]))
  })

  it('catches a middle edge piece that appears twice', () => {
    // White–red painted as a second white–green, with a green square
    // round a centre painted red to keep 25 of each colour.
    const cube = [...SOLVED_5X5]
    cube[cellOf(MIDDLE_EDGES[UR], 'red')] = 'green'
    cube[ringOf('edge').find((cell) => cube[cell] === 'green')!] = 'red'
    const result = expectProblem(cube, 'edges')
    expect(result.message).toBe(
      'The white–green middle edge piece appears more than once, so another middle edge piece is missing. Check the highlighted middle edge pieces.',
    )
    expect(result.cells).toEqual(
      sorted([...MIDDLE_EDGES[UF], ...MIDDLE_EDGES[UR]]),
    )
  })

  it('catches an outer edge piece with the same colour on both sides', () => {
    const result = expectProblem(
      swapCells(
        SOLVED_5X5,
        cellOf(OUTER_EDGES[2 * UF], 'green'),
        cellOf(OUTER_EDGES[2 * UR], 'white'),
      ),
      'edges',
    )
    expect(result.message).toBe(
      "An outer edge piece is white on both sides, so it can't exist.",
    )
    expect(result.cells).toEqual(sorted([...OUTER_EDGES[2 * UF]]))
  })

  it('catches an outer edge piece painted the wrong way round, as its mirror-image twin appearing twice', () => {
    const [first, second] = OUTER_EDGES[2 * UF]
    const result = expectProblem(swapCells(SOLVED_5X5, first, second), 'edges')
    expect(result.message).toBe(
      "There are two of the same white–green outer edge piece. A 5x5's two white–green outer edge pieces are mirror images, so one of these is probably painted the wrong way round. Check the highlighted outer edge pieces.",
    )
    expect(result.cells).toEqual(
      sorted([...OUTER_EDGES[2 * UF], ...OUTER_EDGES[2 * UF + 1]]),
    )
  })

  it('catches a corner whose colours are in mirror-image order', () => {
    const [, urfRight, urfFront] = CORNERS_5X5[0]
    const result = expectProblem(
      swapCells(SOLVED_5X5, urfRight, urfFront),
      'corners',
    )
    expect(result.message).toContain('mirror-image')
    expect(result.cells).toEqual(sorted(CORNERS_5X5[0]))
  })

  it('catches a ring round the centres without 4 of each colour, outlining the squares it has too many of', () => {
    // A white square diagonally next to its centre swapped with a red one
    // right beside its centre: every piece is still real.
    const diagonal = ringOf('corner')
    const beside = ringOf('edge')
    const white = diagonal.find((cell) => SOLVED_5X5[cell] === 'white')!
    const red = beside.find((cell) => SOLVED_5X5[cell] === 'red')!
    const cube = swapCells(SOLVED_5X5, white, red)
    const result = expectProblem(cube, 'center-pieces')
    expect(result.message).toBe(
      'Round the centres, each colour needs 4 squares diagonally next to a centre and 4 right beside one. But white has 3 diagonal and 5 beside; red has 5 diagonal and 3 beside. Check the highlighted squares.',
    )
    // The 5 red diagonal squares and the 5 white beside ones, the swapped pair among them.
    expect(result.cells).toEqual(
      sorted([
        ...diagonal.filter((cell) => cube[cell] === 'red'),
        ...beside.filter((cell) => cube[cell] === 'white'),
      ]),
    )
    expect(result.cells).toHaveLength(10)
    expect(result.cells).toEqual(expect.arrayContaining([white, red]))
  })

  it('catches one twisted corner, held any way, and highlights all corners', () => {
    const [up, right, front] = CORNERS_5X5[0]
    const twisted = [...SOLVED_5X5]
    twisted[up] = SOLVED_5X5[front]
    twisted[right] = SOLVED_5X5[up]
    twisted[front] = SOLVED_5X5[right]
    for (const turns of ['', 'x', "y2 z'"]) {
      const result = expectProblem(
        applyMoves(twisted, parseMoves(turns)),
        'twist',
      )
      expect(result.message).toContain('A corner is twisted')
      expect(result.cells).toHaveLength(24)
    }
  })

  it('catches one flipped middle edge piece, as a 3x3 would, and highlights them all', () => {
    const [up, front] = MIDDLE_EDGES[UF]
    const result = expectProblem(swapCells(SOLVED_5X5, up, front), 'flip')
    expect(result.message).toBe(
      'A middle edge piece is flipped: its two colours are the wrong way round. Check each middle edge piece against your cube.',
    )
    expect(result.cells).toEqual(sorted(MIDDLE_EDGES.flat()))
  })

  it('catches two swapped corners, or two swapped middle edge pieces, as a 3x3 would', () => {
    for (const cube of [
      swapPieces(SOLVED_5X5, CORNERS_5X5[0], CORNERS_5X5[1]),
      swapPieces(SOLVED_5X5, MIDDLE_EDGES[UF], MIDDLE_EDGES[UR]),
    ]) {
      const result = expectProblem(cube, 'swap')
      expect(result.message).toBe(
        'Two pieces seem to have swapped places. Check every piece against your cube.',
      )
    }
  })
})
