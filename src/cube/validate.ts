import {
  cornerCellsOf,
  CORNERS,
  EDGE_CELLS,
  EDGES,
  faceColorsOf,
  toCubies,
  WING_CELLS,
  wingsOf,
} from './cubies.ts'
import { puzzleOf } from './puzzle.ts'
import {
  centerCell,
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
 *
 * The same checks work for a 2x2 (told apart by its 24 cells), minus the
 * ones about centres and edges, which it doesn't have. With no centres to
 * say which colours are opposite, a 2x2 is assumed to have the standard
 * colours (see faceColorsOf).
 *
 * A 4x4 (96 cells) is checked like a 2x2 with edges: its 24 edge pieces
 * must each be real and appear once, as must its corners, and the corner
 * twists must add up. That's all. Any arrangement of a 4x4's edge pieces
 * and centres can be reached by turning, even ones that would be a flipped
 * edge or two swapped pieces on a 3x3 (its "parity" cases): the solver
 * fixes those, so they aren't painting mistakes.
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
  const puzzle = puzzleOf(cube)
  const isThreeByThree = puzzle.name === '3x3'
  const isFourByFour = puzzle.name === '4x4'
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
      `${blank.length === 1 ? '1 square is' : `${blank.length} squares are`} still blank. Paint all ${puzzle.cellCount} to match your cube.`,
      blank,
    )
  }

  // 2. Nine cells of each colour (four on a 2x2, sixteen on a 4x4).
  const { cellsPerColor } = puzzle
  const counts = colorCounts(cube)
  const wrongCounts = COLORS.filter((color) => counts[color] !== cellsPerColor)
  if (wrongCounts.length > 0) {
    const tooMany = wrongCounts.filter((color) => counts[color] > cellsPerColor)
    return fail(
      'color-count',
      `Each colour needs exactly ${cellsPerColor} squares, but ${listWords(wrongCounts.map((color) => `${color} has ${counts[color]}`))}.`,
      cellsWhere((cell) => tooMany.includes(cell!)),
    )
  }

  // 3. Six different centres. Centres never move, so each one names its face.
  if (puzzle.hasCenters) {
    const centerCells = FACES.map((face) => centerCell(face, puzzle))
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
  }
  // Can't be null: the centres differ (3x3), or are assumed (2x2).
  const scheme = faceColorsOf(cube)!
  const faceOf = (color: Color) => FACES.find((face) => scheme[face] === color)!
  const colorOf = (face: Face) => scheme[face]
  const pieceName = (name: string) =>
    [...name].map((face) => colorOf(face as Face)).join('–')
  const colorsAt = (cells: number[]) => cells.map((cell) => cube[cell]!)
  const hasOpposites = (colors: Color[]) =>
    colors.some((a) => colors.some((b) => faceOf(b) === OPPOSITE[faceOf(a)]))
  const cubies = toCubies(cube)! // can't be null: every cell is painted and the centres differ
  const cornerCells = cornerCellsOf(puzzle)
  const badEdgeReason = ([a, b]: Color[]) =>
    a === b
      ? `is ${a} on both sides`
      : `has ${a} and ${b}, which are on opposite sides of the cube`

  // 4. Every edge's two colours belong together, and each of the 12 edges
  //    appears once. (A 2x2 has no edges.)
  const edgeCells = isThreeByThree ? EDGE_CELLS : []
  const badEdges = edgeCells.filter((_, slot) => cubies.ep[slot] === -1)
  if (badEdges.length > 0) {
    return fail(
      'edges',
      `An edge ${badEdgeReason(colorsAt(badEdges[0]))}, so it can't exist.${andMore(badEdges.length, 'edge')}`,
      badEdges.flat(),
    )
  }
  const repeatedEdges = repeatedSlots(cubies.ep)
  if (repeatedEdges.length > 0) {
    return fail(
      'edges',
      `The ${pieceName(EDGES[cubies.ep[repeatedEdges[0]]])} edge appears more than once, so another edge is missing. Check the highlighted edges.`,
      repeatedEdges.flatMap((slot) => edgeCells[slot]),
    )
  }

  // 4 on a 4x4: every edge piece's two colours belong together, and each of
  //    the 24 appears once. The two pieces of an edge are mirror images, so
  //    one painted the wrong way round shows up as its twin appearing twice.
  if (isFourByFour) {
    const wings = wingsOf(cube)
    const badWings = WING_CELLS.filter((_, slot) => wings[slot] === -1)
    if (badWings.length > 0) {
      return fail(
        'edges',
        `An edge piece ${badEdgeReason(colorsAt([...badWings[0]]))}, so it can't exist.${andMore(badWings.length, 'edge piece')}`,
        badWings.flat(),
      )
    }
    const repeatedWings = repeatedSlots(wings)
    if (repeatedWings.length > 0) {
      const piece = wings[repeatedWings[0]]
      const name = pieceName(EDGES[piece >> 1])
      // Both of this edge's pieces, as painted: twins, if just one is the wrong way round.
      const twins = wings.filter((other) => other >> 1 === piece >> 1)
      return fail(
        'edges',
        twins.length === 2
          ? `There are two of the same ${name} edge piece. A 4x4's two ${name} edge pieces are mirror images, so one of these is probably painted the wrong way round. Check the highlighted edge pieces.`
          : `The ${name} edge piece appears more than once, so another edge piece is missing. Check the highlighted edge pieces.`,
        repeatedWings.flatMap((slot) => WING_CELLS[slot]),
      )
    }
  }

  // 5. Every corner's three colours form a real corner, in the right clockwise
  //    order, and each of the 8 corners appears once.
  const badCorners = cornerCells.filter((_, slot) => cubies.cp[slot] === -1)
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
      repeatedCorners.flatMap((slot) => cornerCells[slot]),
    )
  }

  // 6–8. Every piece is real and present, but a real cube can't reach every
  //      arrangement of them by turning: these three rules must also hold.
  //      A 2x2 only has the first: with no edges, any arrangement of its
  //      corners can be reached, even two swapped. So does a 4x4 (see the
  //      top of this file).
  if (sum(cubies.co) % 3 !== 0) {
    return fail(
      'twist',
      'A corner is twisted: its colours are right but turned the wrong way. Check each corner against your cube.',
      cornerCells.flat(),
    )
  }
  if (!isThreeByThree) return { valid: true, solved: isSolved(cube) }
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
