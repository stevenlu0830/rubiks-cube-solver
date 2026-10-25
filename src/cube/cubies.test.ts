import { describe, expect, it } from 'vitest'
import { seededRandom } from '../test/seededRandom.ts'
import {
  CORNER_CELLS,
  CORNERS,
  EDGE_CELLS,
  EDGES,
  fromCubies,
  solvedCubies,
  toCubies,
  type CubieCube,
} from './cubies.ts'
import { STICKERS, type Vec3 } from './geometry.ts'
import {
  applyMove,
  applyMoves,
  parseMoves,
  randomScramble,
  type Move,
} from './moves.ts'
import {
  CENTER,
  cellIndex,
  emptyState,
  FACES,
  solvedState,
  STANDARD_SCHEME,
  type ColorScheme,
  type CubeState,
} from './state.ts'

const cornerIndexes = (names: string) =>
  names.split(' ').map((name) => CORNERS.findIndex((c) => c === name))
const edgeIndexes = (names: string) =>
  names.split(' ').map((name) => EDGES.findIndex((e) => e === name))
const numbers = (digits: string) => digits.split(' ').map(Number)

const schemeOf = (state: CubeState) =>
  Object.fromEntries(
    FACES.map((face) => [face, state[cellIndex(face, CENTER)]]),
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
    state[cellIndex('U', CENTER)] = 'yellow'
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
