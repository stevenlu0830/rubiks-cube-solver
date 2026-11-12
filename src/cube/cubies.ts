import {
  faceNormal,
  outerLayer,
  stickerIndexAt,
  type Vec3,
} from './geometry.ts'
import { perPuzzle, PUZZLE_3X3, puzzleOf, type Puzzle } from './puzzle.ts'
import {
  CENTER,
  cellIndex,
  FACES,
  STANDARD_SCHEME,
  type Color,
  type ColorScheme,
  solvedState,
  type CubeState,
  type Face,
} from './state.ts'

/**
 * The cube as pieces instead of stickers: which corner and edge piece sits in
 * each slot, and how it is turned there. The checks before solving need this
 * view, because the rules for a solvable cube (e.g. "corner twists must add
 * up to a multiple of 3") are about pieces, not stickers.
 *
 * A 2x2 has the same 8 corners, and no edges.
 *
 * Numbering and orientation follow Kociemba's cubie model. A piece's name
 * lists its faces starting with U or D (for corners) and going clockwise, so
 * 'URF' is the Up-Right-Front corner. The same names label both slots
 * (fixed places on the cube) and pieces (the plastic bits that move between
 * them): on a solved cube, piece URF sits in slot URF.
 */
export const CORNERS = [
  'URF',
  'UFL',
  'ULB',
  'UBR',
  'DFR',
  'DLF',
  'DBL',
  'DRB',
] as const
export const EDGES = [
  'UR',
  'UF',
  'UL',
  'UB',
  'DR',
  'DF',
  'DL',
  'DB',
  'FR',
  'FL',
  'BL',
  'BR',
] as const

export interface CubieCube {
  /** cp[slot] = which corner piece is in that slot (index into CORNERS), or -1 if its colours match no real corner. */
  cp: number[]
  /** co[slot] = how the corner is twisted: 0 when its U/D-coloured sticker faces up or down, otherwise 1 or 2. */
  co: number[]
  /** ep[slot] = which edge piece is in that slot (index into EDGES), or -1 if its colours match no real edge. */
  ep: number[]
  /** eo[slot] = 0 if the edge sits the right way round, 1 if it is flipped. */
  eo: number[]
}

/** The cell indexes of each slot's stickers, in the order its name lists faces. */
function slotCells(name: string, puzzle: Puzzle): number[] {
  const faces = [...name] as Face[]
  // The slot's cubie is in the outer layer of each face it touches.
  const outer = outerLayer(puzzle)
  const position = faces
    .map(faceNormal)
    .reduce<Vec3>(
      (sum, n) => [
        sum[0] + n[0] * outer,
        sum[1] + n[1] * outer,
        sum[2] + n[2] * outer,
      ],
      [0, 0, 0],
    )
  return faces.map((face) => stickerIndexAt(position, faceNormal(face), puzzle))
}

/** Each corner slot's cells, for either cube. */
export const cornerCellsOf = perPuzzle((puzzle) =>
  CORNERS.map((name) => slotCells(name, puzzle)),
)

/** A 3x3's corner slots' cells. */
export const CORNER_CELLS: readonly number[][] = cornerCellsOf(PUZZLE_3X3)
/** A 3x3's edge slots' cells (a 2x2 has no edges). */
export const EDGE_CELLS: readonly number[][] = EDGES.map((name) =>
  slotCells(name, PUZZLE_3X3),
)

export function solvedCubies(): CubieCube {
  return {
    cp: CORNERS.map((_, i) => i),
    co: CORNERS.map(() => 0),
    ep: EDGES.map((_, i) => i),
    eo: EDGES.map(() => 0),
  }
}

/**
 * Which colour each face is when the cube is solved. On a 3x3 the centres
 * say, whichever way the cube is held; null unless they're six different
 * colours. A 2x2 has no centres, so the standard colours are assumed: for
 * checking one, all that matters is which colours are opposite and their
 * order round each corner, which is the same however it's held.
 */
export function faceColorsOf(state: CubeState): ColorScheme | null {
  if (!puzzleOf(state).hasCenters) return STANDARD_SCHEME
  const scheme: Partial<Record<Face, Color>> = {}
  for (const face of FACES) {
    const center = state[cellIndex(face, CENTER)]
    if (center === null || Object.values(scheme).includes(center)) return null
    scheme[face] = center
  }
  return scheme as ColorScheme
}

/**
 * Reads which piece is in each slot from the cell colours. Each face is
 * identified by its colour (see faceColorsOf), so this works whichever way
 * the cube is held. A 2x2 has corners only, so its edge lists are empty.
 *
 * Returns null if any cell is unpainted or a 3x3's six centres aren't six
 * different colours, because then the pieces can't be identified at all.
 */
export function toCubies(state: CubeState): CubieCube | null {
  const scheme = faceColorsOf(state)
  if (scheme === null) return null
  if (state.some((cell) => cell === null)) return null
  const faceOfColor = new Map(FACES.map((face) => [scheme[face], face]))
  const faceAt = (cell: number) => faceOfColor.get(state[cell]!)!
  const puzzle = puzzleOf(state)

  const cp: number[] = []
  const co: number[] = []
  for (const cells of cornerCellsOf(puzzle)) {
    const faces = cells.map(faceAt)
    // The twist is which of the slot's three stickers shows the U or D colour.
    const twist = faces.findIndex((face) => face === 'U' || face === 'D')
    const piece =
      twist === -1
        ? -1
        : CORNERS.findIndex((corner) =>
            [...corner].every((face, k) => face === faces[(twist + k) % 3]),
          )
    cp.push(piece)
    co.push(piece === -1 ? 0 : twist)
  }

  const ep: number[] = []
  const eo: number[] = []
  for (const [a, b] of puzzle.name === '3x3' ? EDGE_CELLS : []) {
    const straight = EDGES.findIndex((edge) => edge === faceAt(a) + faceAt(b))
    const flipped = EDGES.findIndex((edge) => edge === faceAt(b) + faceAt(a))
    ep.push(straight !== -1 ? straight : flipped)
    eo.push(straight === -1 && flipped !== -1 ? 1 : 0)
  }

  return { cp, co, ep, eo }
}

/** The opposite of toCubies: paints the cells for these pieces. */
export function fromCubies(
  { cp, co, ep, eo }: CubieCube,
  scheme: ColorScheme,
): CubeState {
  if (cp.includes(-1) || ep.includes(-1)) {
    throw new Error('Cannot paint a cube with unrecognised pieces')
  }
  const state = [...solvedState(scheme)]
  CORNER_CELLS.forEach((cells, slot) => {
    const corner = CORNERS[cp[slot]]
    for (let k = 0; k < 3; k++) {
      state[cells[(k + co[slot]) % 3]] = scheme[corner[k] as Face]
    }
  })
  EDGE_CELLS.forEach((cells, slot) => {
    const edge = EDGES[ep[slot]]
    for (let k = 0; k < 2; k++) {
      state[cells[(k + eo[slot]) % 2]] = scheme[edge[k] as Face]
    }
  })
  return state
}
