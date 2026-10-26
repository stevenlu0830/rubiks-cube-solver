import { CORNER_CELLS, CORNERS, EDGE_CELLS, EDGES, toCubies } from './cubies.ts'
import {
  CELLS_PER_COLOR,
  CENTER,
  cellIndex,
  colorCounts,
  COLORS,
  FACES,
  isSolved,
  type Color,
  type CubeState,
  type Face,
} from './state.ts'

/**
 * Checks that the painted cube is one a real Rubik's cube could be in, before
 * trying to solve it. A cube with one sticker painted wrong can't be solved,
 * and a solver given one would fail or produce nonsense, so it's far better
 * to catch the mistake here and point at it.
 *
 * The checks run from the simplest to the subtlest, and stop at the first
 * problem, because later checks only make sense once earlier ones pass
 * (e.g. pieces can't be identified until the centres are known).
 */

export type Problem =
  | 'unpainted'
  | 'color-count'
  | 'centers'
  | 'edges'
  | 'corners'
  | 'twist'
  | 'flip'
  | 'swap'

export type Validation =
  | { valid: true; solved: boolean }
  | {
      valid: false
      problem: Problem
      /** What's wrong, in words for the user. */
      message: string
      /** Cells to highlight on the cube; empty when no particular cell is to blame. */
      cells: number[]
    }

const OPPOSITE: Record<Face, Face> = {
  U: 'D',
  D: 'U',
  R: 'L',
  L: 'R',
  F: 'B',
  B: 'F',
}

export function validateCube(cube: CubeState): Validation {
  const fail = (
    problem: Problem,
    message: string,
    cells: number[],
  ): Validation => ({
    valid: false,
    problem,
    message,
    cells,
  })
  const cellsWhere = (test: (cell: Color | null) => boolean) =>
    cube.flatMap((cell, i) => (test(cell) ? [i] : []))

  // 1. Every cell painted.
  const blank = cellsWhere((cell) => cell === null)
  if (blank.length > 0) {
    return fail(
      'unpainted',
      `${blank.length === 1 ? '1 square is' : `${blank.length} squares are`} still blank. Paint all 54 to match your cube.`,
      blank,
    )
  }

  // 2. Nine cells of each colour.
  const counts = colorCounts(cube)
  const wrongCounts = COLORS.filter(
    (color) => counts[color] !== CELLS_PER_COLOR,
  )
  if (wrongCounts.length > 0) {
    const tooMany = wrongCounts.filter(
      (color) => counts[color] > CELLS_PER_COLOR,
    )
    return fail(
      'color-count',
      `Each colour needs exactly 9 squares, but ${listWords(wrongCounts.map((color) => `${color} has ${counts[color]}`))}.`,
      cellsWhere((cell) => tooMany.includes(cell!)),
    )
  }

  // 3. Six different centres. Centres never move, so each one names its face.
  const centerCells = FACES.map((face) => cellIndex(face, CENTER))
  const sharedCenters = centerCells.filter((cell) =>
    centerCells.some((other) => other !== cell && cube[other] === cube[cell]),
  )
  if (sharedCenters.length > 0) {
    return fail(
      'centers',
      `More than one centre is ${cube[sharedCenters[0]]}. The six centres must all be different colours.`,
      sharedCenters,
    )
  }
  const faceOf = (color: Color) =>
    FACES.find((face) => cube[cellIndex(face, CENTER)] === color)!
  const colorOf = (face: Face) => cube[cellIndex(face, CENTER)]!
  const pieceName = (name: string) =>
    [...name].map((face) => colorOf(face as Face)).join('–')
  const colorsAt = (cells: number[]) => cells.map((cell) => cube[cell]!)
  const hasOpposites = (colors: Color[]) =>
    colors.some((a) => colors.some((b) => faceOf(b) === OPPOSITE[faceOf(a)]))
  const cubies = toCubies(cube)! // can't be null: every cell is painted and the centres differ

  // 4. Every edge's two colours belong together, and each of the 12 edges appears once.
  const badEdges = EDGE_CELLS.filter((_, slot) => cubies.ep[slot] === -1)
  if (badEdges.length > 0) {
    const [a, b] = colorsAt(badEdges[0])
    const reason =
      a === b
        ? `An edge is ${a} on both sides`
        : `An edge has ${a} and ${b}, which are on opposite sides of the cube`
    return fail(
      'edges',
      `${reason}, so it can't exist.${andMore(badEdges.length, 'edge')}`,
      badEdges.flat(),
    )
  }
  const repeatedEdges = repeatedSlots(cubies.ep)
  if (repeatedEdges.length > 0) {
    return fail(
      'edges',
      `The ${pieceName(EDGES[cubies.ep[repeatedEdges[0]]])} edge appears more than once, so another edge is missing. Check the highlighted edges.`,
      repeatedEdges.flatMap((slot) => EDGE_CELLS[slot]),
    )
  }

  // 5. Every corner's three colours form a real corner, in the right clockwise
  //    order, and each of the 8 corners appears once.
  const badCorners = CORNER_CELLS.filter((_, slot) => cubies.cp[slot] === -1)
  if (badCorners.length > 0) {
    const colors = colorsAt(badCorners[0])
    const repeated = colors.find((color, i) => colors.indexOf(color) !== i)
    const reason = repeated
      ? `A corner has ${repeated} twice, so it can't exist.`
      : hasOpposites(colors)
        ? `A corner has colours from opposite sides of the cube (${listWords(colors)}), so it can't exist.`
        : `A corner's colours (${listWords(colors)}) are in mirror-image order. Two of its squares are probably swapped.`
    return fail(
      'corners',
      `${reason}${andMore(badCorners.length, 'corner')}`,
      badCorners.flat(),
    )
  }
  const repeatedCorners = repeatedSlots(cubies.cp)
  if (repeatedCorners.length > 0) {
    return fail(
      'corners',
      `The ${pieceName(CORNERS[cubies.cp[repeatedCorners[0]]])} corner appears more than once, so another corner is missing. Check the highlighted corners.`,
      repeatedCorners.flatMap((slot) => CORNER_CELLS[slot]),
    )
  }

  // 6–8. Every piece is real and present, but a real cube can't reach every
  //      arrangement of them by turning: these three rules must also hold.
  if (sum(cubies.co) % 3 !== 0) {
    return fail(
      'twist',
      'A corner is twisted: its colours are right but turned the wrong way. Check each corner against your cube.',
      CORNER_CELLS.flat(),
    )
  }
  if (sum(cubies.eo) % 2 !== 0) {
    return fail(
      'flip',
      'An edge is flipped: its two colours are the wrong way round. Check each edge against your cube.',
      EDGE_CELLS.flat(),
    )
  }
  if (swapParity(cubies.cp) !== swapParity(cubies.ep)) {
    return fail(
      'swap',
      'Two pieces seem to have swapped places. Check every piece against your cube.',
      [],
    )
  }

  return { valid: true, solved: isSolved(cube) }
}

/** The slots whose piece also appears in another slot. */
function repeatedSlots(pieces: number[]): number[] {
  return pieces.flatMap((piece, slot) =>
    pieces.indexOf(piece) !== pieces.lastIndexOf(piece) ? [slot] : [],
  )
}

/**
 * Whether rearranging pieces into this order takes an even (0) or odd (1)
 * number of swaps. Every face turn swaps corners and edges an equal number
 * of times, so on a real cube the corners and edges always match.
 */
function swapParity(permutation: number[]): number {
  const visited = permutation.map(() => false)
  let swaps = 0
  for (let start = 0; start < permutation.length; start++) {
    // Follow the cycle of pieces starting here; a cycle of n pieces takes n - 1 swaps.
    let cycleLength = 0
    for (let i = start; !visited[i]; i = permutation[i]) {
      visited[i] = true
      cycleLength++
    }
    if (cycleLength > 0) swaps += cycleLength - 1
  }
  return swaps % 2
}

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0)

const listWords = (words: string[]) =>
  words.length <= 1
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`

const andMore = (count: number, noun: string) =>
  count > 1 ? ` (${count} ${noun}s have problems; all are highlighted.)` : ''
