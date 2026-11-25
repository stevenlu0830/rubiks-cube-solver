import {
  dot,
  faceNormal,
  outerLayer,
  stickerIndexAt,
  stickersOf,
  type Vec3,
} from './geometry.ts'
import {
  perPuzzle,
  PUZZLE_3X3,
  PUZZLE_4X4,
  puzzleOf,
  type Puzzle,
} from './puzzle.ts'
import {
  cellIndex,
  centerCell,
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
 * A 2x2 has the same 8 corners, and no edges. A 4x4 has the same 8
 * corners, but each of its 12 edges is two separate edge pieces (see
 * wingCellsOf), and its centres are 24 pieces that move about (see
 * centreRingsOf). A 5x5 has both kinds of edge piece: a middle one on each
 * edge, which acts like a 3x3's edge (see edgeCellsOf), with an outer one
 * either side of it, like a 4x4's. Its centres are a fixed one in the middle
 * of each face, like a 3x3's, ringed by 8 that move about.
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

/** Each corner slot's cells, for any cube. */
export const cornerCellsOf = perPuzzle((puzzle) =>
  CORNERS.map((name) => slotCells(name, puzzle)),
)

/**
 * Each edge slot's cells, in the order of EDGES, on a cube whose edges have
 * a middle piece: a 3x3's edges, or a 5x5's middle edge pieces. They move
 * and flip exactly as a 3x3's edges do. A 2x2 has no edges, and a 4x4's are
 * two pieces each with no middle one (see wingCellsOf), so both have none.
 */
export const edgeCellsOf = perPuzzle((puzzle): readonly number[][] =>
  puzzle.size % 2 === 1 && puzzle.size > 1
    ? EDGES.map((name) => slotCells(name, puzzle))
    : [],
)

/** A 3x3's corner slots' cells. */
export const CORNER_CELLS: readonly number[][] = cornerCellsOf(PUZZLE_3X3)
/** A 3x3's edge slots' cells (a 2x2 has no edges). */
export const EDGE_CELLS: readonly number[][] = edgeCellsOf(PUZZLE_3X3)

/**
 * The cells of the centre pieces: the squares that aren't on a corner or
 * an edge. A 3x3 has 6, one in the middle of each face, which never move;
 * a 4x4 has 24, four in the middle of each face, which do; a 5x5 has 54,
 * nine in the middle of each face, of which only the middle one stays put;
 * a 2x2 has none.
 */
export const centreCellsOf = perPuzzle((puzzle): readonly number[] => {
  const stickers = stickersOf(puzzle)
  const onCubie = new Map<string, number>()
  for (const { position } of stickers) {
    onCubie.set(`${position}`, (onCubie.get(`${position}`) ?? 0) + 1)
  }
  return stickers.flatMap(({ position }, cell) =>
    onCubie.get(`${position}`) === 1 ? [cell] : [],
  )
})

/**
 * Which ring a centre square is in (see centreRingsOf): `corner` for the
 * squares diagonally next to a face's middle, `edge` for those right beside
 * it (above, below or to the side).
 */
export type CentreRingKind = 'corner' | 'edge'

export interface CentreRing {
  kind: CentreRingKind
  /**
   * Its 24 squares, 4 on each face, face by face in the order U R F D L B,
   * each face's in reading order: cells[4f + k] is on FACES[f].
   */
  cells: readonly number[]
}

/**
 * A cube's centre squares that move, in "rings": squares that turning
 * moves among each other, but never out of. Each ring has 4 squares on
 * every face, so a solved cube has 4 of each colour in it.
 *
 * - A 4x4 has one: the 4 squares in the middle of each face, the corners
 *   of its middle 2x2.
 * - A 5x5 has two, round its fixed centre: the 4 squares diagonally next to
 *   it, the corners of the face's middle 3×3 (a `corner` ring, often called
 *   "x-centres"), and the 4 squares right beside it, the edges of the
 *   middle 3×3 (an `edge` ring, "+-centres"). However it's turned, a square
 *   in one can never reach the other's places.
 * - A 2x2 has no centres, and a 3x3's never move, so neither has a ring.
 */
export const centreRingsOf = perPuzzle((puzzle): readonly CentreRing[] => {
  const outer = outerLayer(puzzle)
  const rings = new Map<CentreRingKind, number[]>()
  for (const face of FACES) {
    for (let n = 0; n < puzzle.cellsPerFace; n++) {
      // How far the square is from the middle of its face, across and down.
      const across = Math.abs((n % puzzle.size) - outer)
      const down = Math.abs(Math.floor(n / puzzle.size) - outer)
      const onBorder = across === outer || down === outer
      const fixed = across === 0 && down === 0
      if (onBorder || fixed) continue
      const kind = across === down ? 'corner' : 'edge'
      if (!rings.has(kind)) rings.set(kind, [])
      rings.get(kind)!.push(cellIndex(face, n, puzzle))
    }
  }
  return [...rings].map(([kind, cells]) => ({ kind, cells }))
})

/**
 * The outer edge pieces of a 4x4 or 5x5 (often called "wings"): 24 in all,
 * two on each of the 12 edges, in the order of EDGES, so pieces 2e and
 * 2e + 1 are both on edge EDGES[e]. On a 4x4 they're the whole edge; on a
 * 5x5 they're either side of its middle piece (see edgeCellsOf). Each lists
 * its two cells in the same order: first the one whose sticker turns
 * clockwise into the other about the edge (see below). A 2x2 or 3x3 has
 * none.
 *
 * The two edge pieces of an edge are mirror images, and neither can be
 * flipped round in place: turning the cube can take a piece to any edge
 * slot, but it always arrives the same way round. So a piece's two colours,
 * read in this order, say exactly which of the 24 it is: on a solved cube,
 * the white–green edge has one piece reading white then green, and the
 * other green then white.
 */
export const wingCellsOf = perPuzzle(
  (puzzle): readonly (readonly [number, number])[] =>
    puzzle.size < 4 ? [] : EDGES.flatMap((name) => wingsOnEdge(name, puzzle)),
)

/** A 4x4's 24 edge pieces (see wingCellsOf). */
export const WING_CELLS = wingCellsOf(PUZZLE_4X4)

/** The two outer edge pieces of one edge, either side of its middle (see wingCellsOf). */
function wingsOnEdge(
  name: (typeof EDGES)[number],
  puzzle: Puzzle,
): (readonly [number, number])[] {
  const outer = outerLayer(puzzle)
  const [a, b] = ([...name] as Face[]).map(faceNormal)
  // The direction the edge runs along: the axis neither face points down.
  const along: Vec3 = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
  // Each piece is next to a corner, 1 in from the end of the edge.
  return [1 - outer, outer - 1].map((t): readonly [number, number] => {
    const position: Vec3 = [0, 1, 2].map(
      (k) => (a[k] + b[k]) * outer + along[k] * t,
    ) as unknown as Vec3
    const cellA = stickerIndexAt(position, a, puzzle)
    const cellB = stickerIndexAt(position, b, puzzle)
    // a × b is `along`, so face a's sticker comes first where the piece
    // is on the + side of the edge's middle.
    return dot(along, position) > 0 ? [cellA, cellB] : [cellB, cellA]
  })
}

/**
 * Which of the 24 outer edge pieces (see wingCellsOf) is in each of their
 * slots on a 4x4 or 5x5, told by its two colours in order: -1 where they
 * match no real piece, or a square is blank. Each colour's face is read
 * from the centres (see faceColorsOf): a 5x5's fixed ones, or on a 4x4,
 * with none, the standard colours. All -1 if a 5x5's centres aren't six
 * different colours.
 */
export function wingsOf(cube: CubeState): number[] {
  const puzzle = puzzleOf(cube)
  const cells = wingCellsOf(puzzle)
  const scheme = faceColorsOf(cube)
  if (scheme === null) return cells.map(() => -1)
  const faceOf = new Map<Color | null, Face>(
    FACES.map((face) => [scheme[face], face]),
  )
  const pieces = wingPieces(puzzle)
  return cells.map(
    ([a, b]) =>
      pieces.get(`${faceOf.get(cube[a])}${faceOf.get(cube[b])}`) ?? -1,
  )
}

/**
 * Each outer edge piece by the faces its two colours belong on, in order,
 * as "UF": worked out once, as scanning checks thousands of cubes in a row.
 */
const wingPieces = perPuzzle((puzzle) => {
  const solved = FACES.flatMap((face) =>
    Array<Face>(puzzle.cellsPerFace).fill(face),
  )
  return new Map(
    wingCellsOf(puzzle).map(([a, b], piece) => [
      `${solved[a]}${solved[b]}`,
      piece,
    ]),
  )
})

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
  const puzzle = puzzleOf(state)
  if (!puzzle.hasCenters) return STANDARD_SCHEME
  const scheme: Partial<Record<Face, Color>> = {}
  for (const face of FACES) {
    const center = state[centerCell(face, puzzle)]
    if (center === null || Object.values(scheme).includes(center)) return null
    scheme[face] = center
  }
  return scheme as ColorScheme
}

/**
 * Reads which piece is in each slot from the cell colours. Each face is
 * identified by its colour (see faceColorsOf), so this works whichever way
 * the cube is held. A 2x2 or 4x4 has no middle edge pieces, so its edge
 * lists are empty; a 5x5's are its middle edge pieces (see edgeCellsOf).
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
  for (const [a, b] of edgeCellsOf(puzzle)) {
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
