import { describe, expect, it } from 'vitest'
import { seededRandom } from '../helpers/seededRandom.ts'
import {
  centreCellsOf,
  CORNER_CELLS,
  cornerCellsOf,
  CORNERS,
  EDGE_CELLS,
  EDGES,
  faceColorsOf,
  fromCubies,
  solvedCubies,
  toCubies,
  WING_CELLS,
  wingsOf,
  type CubieCube,
} from '../../src/cube/cubies.ts'
import { STICKERS, stickersOf, type Vec3 } from '../../src/cube/geometry.ts'
import {
  PUZZLE_2X2,
  PUZZLE_3X3,
  PUZZLE_4X4,
  PUZZLE_5X5,
} from '../../src/cube/puzzle.ts'
import {
  applyMove,
  applyMoves,
  movesOf,
  parseMoves,
  randomScramble,
  type Move,
} from '../../src/cube/moves.ts'
import {
  centerCell,
  cellIndex,
  emptyState,
  FACES,
  solvedState,
  STANDARD_SCHEME,
  type ColorScheme,
  type CubeState,
} from '../../src/cube/state.ts'

const cornerIndexes = (names: string) =>
  names.split(' ').map((name) => CORNERS.findIndex((c) => c === name))
const edgeIndexes = (names: string) =>
  names.split(' ').map((name) => EDGES.findIndex((e) => e === name))
const numbers = (digits: string) => digits.split(' ').map(Number)

const schemeOf = (state: CubeState) =>
  Object.fromEntries(
    FACES.map((face) => [face, state[centerCell(face)]]),
  ) as ColorScheme

describe('slot cells', () => {
  // Kociemba's published facelet tables, converted to 0-based cell indexes.
  // An independent check that our geometry puts every sticker where the solver expects.
  it('match the Kociemba corner table', () => {
    expect(CORNER_CELLS).toEqual([
      [8, 9, 20], // URF: U9 R1 F3
      [6, 18, 38], // UFL: U7 F1 L3
      [0, 36, 47], // ULB: U1 L1 B3
      [2, 45, 11], // UBR: U3 B1 R3
      [29, 26, 15], // DFR: D3 F9 R7
      [27, 44, 24], // DLF: D1 L9 F7
      [33, 53, 42], // DBL: D7 B9 L7
      [35, 17, 51], // DRB: D9 R9 B7
    ])
  })

  it('match the Kociemba edge table', () => {
    expect(EDGE_CELLS).toEqual([
      [5, 10], // UR
      [7, 19], // UF
      [3, 37], // UL
      [1, 46], // UB
      [32, 16], // DR
      [28, 25], // DF
      [30, 43], // DL
      [34, 52], // DB
      [23, 12], // FR
      [21, 41], // FL
      [50, 39], // BL
      [48, 14], // BR
    ])
  })

  it('list each corner’s stickers in clockwise order', () => {
    // Three face directions listed clockwise around a corner have determinant -1.
    const det = ([a, b, c]: Vec3[]) =>
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0])
    for (const cells of CORNER_CELLS) {
      expect(det(cells.map((cell) => STICKERS[cell].normal))).toBe(-1)
    }
  })
})

describe('toCubies', () => {
  it('reads a solved cube as every piece in its own slot, untwisted', () => {
    expect(toCubies(solvedState())).toEqual(solvedCubies())
  })

  it.each(['x', 'y', "z'", 'x2'] as const)(
    'still reads a solved cube as solved after rotating it with %s',
    (rotation) => {
      expect(toCubies(applyMove(solvedState(), rotation))).toEqual(
        solvedCubies(),
      )
    },
  )

  // Kociemba's reference result of each face turn on a solved cube.
  const reference: [Move, CubieCube][] = [
    [
      'U',
      {
        cp: cornerIndexes('UBR URF UFL ULB DFR DLF DBL DRB'),
        co: numbers('0 0 0 0 0 0 0 0'),
        ep: edgeIndexes('UB UR UF UL DR DF DL DB FR FL BL BR'),
        eo: numbers('0 0 0 0 0 0 0 0 0 0 0 0'),
      },
    ],
    [
      'R',
      {
        cp: cornerIndexes('DFR UFL ULB URF DRB DLF DBL UBR'),
        co: numbers('2 0 0 1 1 0 0 2'),
        ep: edgeIndexes('FR UF UL UB BR DF DL DB DR FL BL UR'),
        eo: numbers('0 0 0 0 0 0 0 0 0 0 0 0'),
      },
    ],
    [
      'F',
      {
        cp: cornerIndexes('UFL DLF ULB UBR URF DFR DBL DRB'),
        co: numbers('1 2 0 0 2 1 0 0'),
        ep: edgeIndexes('UR FL UL UB DR FR DL DB UF DF BL BR'),
        eo: numbers('0 1 0 0 0 1 0 0 1 1 0 0'),
      },
    ],
    [
      'D',
      {
        cp: cornerIndexes('URF UFL ULB UBR DLF DBL DRB DFR'),
        co: numbers('0 0 0 0 0 0 0 0'),
        ep: edgeIndexes('UR UF UL UB DF DL DB DR FR FL BL BR'),
        eo: numbers('0 0 0 0 0 0 0 0 0 0 0 0'),
      },
    ],
    [
      'L',
      {
        cp: cornerIndexes('URF ULB DBL UBR DFR UFL DLF DRB'),
        co: numbers('0 1 2 0 0 2 1 0'),
        ep: edgeIndexes('UR UF BL UB DR DF FL DB FR UL DL BR'),
        eo: numbers('0 0 0 0 0 0 0 0 0 0 0 0'),
      },
    ],
    [
      'B',
      {
        cp: cornerIndexes('URF UFL UBR DRB DFR DLF ULB DBL'),
        co: numbers('0 0 1 2 0 0 2 1'),
        ep: edgeIndexes('UR UF UL BR DR DF DL BL FR FL UB DB'),
        eo: numbers('0 0 0 1 0 0 0 1 0 0 1 1'),
      },
    ],
  ]
  it.each(reference)(
    'matches the Kociemba reference after %s',
    (move, expected) => {
      expect(toCubies(applyMove(solvedState(), move))).toEqual(expected)
    },
  )

  it('keeps legal twist and flip totals on any scrambled cube', () => {
    const random = seededRandom(5)
    for (let run = 0; run < 100; run++) {
      const cubies = toCubies(
        applyMoves(solvedState(), randomScramble(25, random)),
      )!
      expect(cubies.cp.toSorted((a, b) => a - b)).toEqual(solvedCubies().cp)
      expect(cubies.ep.toSorted((a, b) => a - b)).toEqual(solvedCubies().ep)
      expect(cubies.co.reduce((sum, t) => sum + t, 0) % 3).toBe(0)
      expect(cubies.eo.reduce((sum, f) => sum + f, 0) % 2).toBe(0)
    }
  })

  it('returns null when any cell is unpainted', () => {
    expect(toCubies(emptyState())).toBeNull()
    const state = [...solvedState()]
    state[cellIndex('R', 0)] = null
    expect(toCubies(state)).toBeNull()
  })

  it('returns null when two centres share a colour', () => {
    const state = [...solvedState()]
    state[centerCell('U')] = 'yellow'
    expect(toCubies(state)).toBeNull()
  })

  it('spots a twisted corner', () => {
    const state = [...solvedState()]
    const [u, r, f] = CORNER_CELLS[0] // URF slot: white, red, green
    state[u] = 'green'
    state[r] = 'white'
    state[f] = 'red'
    const cubies = toCubies(state)!
    expect(cubies.cp[0]).toBe(0)
    expect(cubies.co[0]).toBe(1)
  })

  it('spots a flipped edge', () => {
    const state = [...solvedState()]
    const [u, f] = EDGE_CELLS[1] // UF slot: white, green
    state[u] = 'green'
    state[f] = 'white'
    const cubies = toCubies(state)!
    expect(cubies.ep[1]).toBe(1)
    expect(cubies.eo[1]).toBe(1)
  })

  it('marks pieces whose colours cannot exist as -1', () => {
    const state = [...solvedState()]
    state[CORNER_CELLS[0][1]] = 'yellow' // URF corner now white-yellow-green
    state[EDGE_CELLS[1][1]] = 'yellow' // UF edge now white-yellow
    const cubies = toCubies(state)!
    expect(cubies.cp[0]).toBe(-1)
    expect(cubies.ep[1]).toBe(-1)
  })
})

describe('fromCubies', () => {
  it('turns pieces back into the same cells', () => {
    const random = seededRandom(6)
    for (let run = 0; run < 100; run++) {
      const moves = [...parseMoves('x y'), ...randomScramble(25, random)]
      const state = applyMoves(solvedState(), moves)
      expect(fromCubies(toCubies(state)!, schemeOf(state))).toEqual(state)
    }
  })

  it('paints a solved cube from solved pieces', () => {
    expect(fromCubies(solvedCubies(), STANDARD_SCHEME)).toEqual(solvedState())
  })

  it('refuses unrecognised pieces', () => {
    const cubies = solvedCubies()
    cubies.cp[0] = -1
    expect(() => fromCubies(cubies, STANDARD_SCHEME)).toThrow()
  })
})

describe('on a 2x2', () => {
  const SOLVED_2X2 = solvedState(STANDARD_SCHEME, PUZZLE_2X2)

  it("finds each corner slot's 3 cells, on the faces its name lists", () => {
    const stickers = stickersOf(PUZZLE_2X2)
    cornerCellsOf(PUZZLE_2X2).forEach((cells, slot) => {
      expect(cells).toHaveLength(3)
      const faces = cells.map((cell) => FACES[Math.floor(cell / 4)])
      expect(faces.join('')).toBe(CORNERS[slot])
      // All three on the same cubie.
      expect(
        new Set(cells.map((cell) => `${stickers[cell].position}`)).size,
      ).toBe(1)
    })
    expect(
      cornerCellsOf(PUZZLE_2X2)
        .flat()
        .toSorted((a, b) => a - b),
    ).toEqual(Array.from({ length: 24 }, (_, i) => i))
  })

  it('keeps the 3x3 corner cells as they were', () => {
    expect(cornerCellsOf(PUZZLE_3X3)).toBe(CORNER_CELLS)
  })

  it('assumes the standard colours, having no centres to read them from', () => {
    expect(faceColorsOf(SOLVED_2X2)).toBe(STANDARD_SCHEME)
    expect(faceColorsOf(applyMoves(SOLVED_2X2, parseMoves('x y')))).toBe(
      STANDARD_SCHEME,
    )
  })

  it('reads a solved 2x2 as every corner in place, and no edges', () => {
    expect(toCubies(SOLVED_2X2)).toEqual({
      cp: [0, 1, 2, 3, 4, 5, 6, 7],
      co: [0, 0, 0, 0, 0, 0, 0, 0],
      ep: [],
      eo: [],
    })
  })

  it('reads its corners exactly like the matching 3x3 corners, after any moves', () => {
    const moves = randomScramble(30, seededRandom(31))
    const twoByTwo = toCubies(applyMoves(SOLVED_2X2, moves))!
    const threeByThree = toCubies(applyMoves(solvedState(), moves))!
    expect(twoByTwo.cp).toEqual(threeByThree.cp)
    expect(twoByTwo.co).toEqual(threeByThree.co)
  })

  it('returns null with a square still blank', () => {
    const cube = [...SOLVED_2X2]
    cube[7] = null
    expect(toCubies(cube)).toBeNull()
  })
})

describe('centreCellsOf', () => {
  it("finds a 3x3's 6 centres, a 4x4's 24 and a 2x2's none", () => {
    expect(centreCellsOf(PUZZLE_3X3)).toEqual(
      FACES.map((face) => centerCell(face)),
    )
    expect(centreCellsOf(PUZZLE_2X2)).toEqual([])
    expect(centreCellsOf(PUZZLE_4X4)).toEqual(
      FACES.flatMap((face) =>
        [5, 6, 9, 10].map((n) => cellIndex(face, n, PUZZLE_4X4)),
      ),
    )
  })
})

describe('on a 4x4', () => {
  const SOLVED_4X4 = solvedState(STANDARD_SCHEME, PUZZLE_4X4)
  const NUMBERED = Array.from({ length: 96 }, (_, i) => i)
  const stickers = stickersOf(PUZZLE_4X4)

  it('has 24 edge pieces, two on each edge, covering all 48 edge squares once', () => {
    expect(WING_CELLS).toHaveLength(24)
    const cells = WING_CELLS.flat()
    expect(new Set(cells).size).toBe(48)
    WING_CELLS.forEach((pair, piece) => {
      const faces = pair.map((cell) => FACES[Math.floor(cell / 16)])
      expect(faces.toSorted().join('')).toBe(
        [...EDGES[piece >> 1]].toSorted().join(''),
      )
      // Both cells on the same cubie, which is on no corner and no centre.
      expect(stickers[pair[0]].position).toEqual(stickers[pair[1]].position)
    })
    const corners = cornerCellsOf(PUZZLE_4X4).flat()
    const centres = centreCellsOf(PUZZLE_4X4)
    expect(
      [...cells, ...corners, ...centres].toSorted((a, b) => a - b),
    ).toEqual(NUMBERED)
  })

  it("lists each piece's cells in an order no move can change: a piece can never be flipped in place", () => {
    const firsts = new Set(WING_CELLS.map(([first]) => first))
    for (const move of movesOf(PUZZLE_4X4)) {
      const from = applyMove(NUMBERED, move)
      for (const first of firsts) expect(firsts).toContain(from[first])
    }
  })

  it("reads the white–green edge's two pieces as mirror images: white then green, and green then white", () => {
    const uf = EDGES.indexOf('UF')
    const read = (piece: number) =>
      WING_CELLS[piece].map((cell) => SOLVED_4X4[cell]).join(' then ')
    expect([read(2 * uf), read(2 * uf + 1)].toSorted()).toEqual([
      'green then white',
      'white then green',
    ])
    const readings = WING_CELLS.map((_, piece) => read(piece))
    expect(new Set(readings).size).toBe(24)
  })

  it('reads a solved 4x4 as every edge piece in its own slot', () => {
    expect(wingsOf(SOLVED_4X4)).toEqual(Array.from({ length: 24 }, (_, i) => i))
  })

  it('finds all 24 edge pieces, once each, after any moves', () => {
    const all = movesOf(PUZZLE_4X4)
    const random = seededRandom(41)
    for (let run = 0; run < 20; run++) {
      const moves = Array.from(
        { length: 40 },
        () => all[Math.floor(random() * all.length)],
      )
      expect(
        wingsOf(applyMoves(SOLVED_4X4, moves)).toSorted((a, b) => a - b),
      ).toEqual(Array.from({ length: 24 }, (_, i) => i))
    }
  })

  it('marks an edge piece whose colours match no real one as -1', () => {
    const cube = [...SOLVED_4X4]
    const [first, second] = WING_CELLS[5]
    cube[first] = cube[second] // the same colour on both sides
    expect(wingsOf(cube)[5]).toBe(-1)
  })

  it('reads its corners like a 2x2, assuming the standard colours', () => {
    const moves = randomScramble(30, seededRandom(42))
    const fourByFour = toCubies(applyMoves(SOLVED_4X4, moves))!
    const twoByTwo = toCubies(
      applyMoves(solvedState(STANDARD_SCHEME, PUZZLE_2X2), moves),
    )!
    expect(fourByFour).toEqual(twoByTwo)
    expect(faceColorsOf(SOLVED_4X4)).toBe(STANDARD_SCHEME)
  })
})

describe('faceColorsOf a 5x5', () => {
  const SOLVED_5X5 = solvedState(STANDARD_SCHEME, PUZZLE_5X5)

  it("reads each face's colour from its middle square, whichever way the cube is held", () => {
    expect(faceColorsOf(SOLVED_5X5)).toEqual(STANDARD_SCHEME)
    const turned = applyMoves(SOLVED_5X5, parseMoves("x y'"))
    for (const face of FACES) {
      expect(faceColorsOf(turned)![face]).toBe(
        turned[centerCell(face, PUZZLE_5X5)],
      )
    }
    expect(faceColorsOf(turned)).not.toEqual(STANDARD_SCHEME)
  })

  it("isn't fooled by the squares round the middle, which move", () => {
    const cube = applyMoves(SOLVED_5X5, parseMoves("r u' Rw f2"))
    expect(faceColorsOf(cube)).toEqual(STANDARD_SCHEME)
  })

  it('is null when a middle square is blank or two are the same colour', () => {
    const blank = [...SOLVED_5X5]
    blank[centerCell('F', PUZZLE_5X5)] = null
    expect(faceColorsOf(blank)).toBeNull()
    const repeated = [...SOLVED_5X5]
    repeated[centerCell('F', PUZZLE_5X5)] = 'white'
    expect(faceColorsOf(repeated)).toBeNull()
  })
})
