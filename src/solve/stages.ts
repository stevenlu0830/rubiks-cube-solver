import { edgeCellsOf, EDGES, wingCellsOf } from '../cube/cubies.ts'
import { puzzleOf } from '../cube/puzzle.ts'
import {
  cellIndex,
  type Color,
  type CubeState,
  type Face,
} from '../cube/state.ts'
import type { StageName } from '../solver/protocol.ts'

/**
 * What each stage of a 4x4's or 5x5's solution is called on screen (see
 * fourByFour.ts and fiveByFive.ts).
 */
export const STAGE_NAMES: Readonly<Record<StageName, string>> = {
  centres: 'Centres',
  edges: 'Pair the edges',
  parity: 'Parity fix',
  finish: 'Finish like a 3x3',
}

/**
 * A face's colour once a 4x4's or 5x5's centres are solved. It's read from
 * the square one in from the face's top-left corner, which is a centre
 * square on any cube bigger than a 2x2. By then all a face's centre squares
 * are that colour: 4 on a 4x4, 9 on a 5x5.
 */
export function centreColor(cube: CubeState, face: Face): Color {
  const puzzle = puzzleOf(cube)
  return cube[cellIndex(face, puzzle.size + 1, puzzle)]!
}

/**
 * The one edge of a 5x5 whose two outer pieces have swapped places, when
 * that's all that's left after its edges are joined up (see fiveByFive.ts).
 * The outer pieces are mirror images, so swapped they show their colours
 * the other way round from the middle piece: along the top front, the
 * white–green edge reads green, white, green. Its slot ('UF'), or null if
 * no edge looks like that, as on any 4x4 (which has no middle pieces).
 */
export function swappedEdge(cube: CubeState): (typeof EDGES)[number] | null {
  const puzzle = puzzleOf(cube)
  const middles = edgeCellsOf(puzzle)
  const outers = wingCellsOf(puzzle)
  const faceOf = (cell: number) => Math.floor(cell / puzzle.cellsPerFace)
  const edge = middles.findIndex(([a, b], e) => {
    /** True if the cell has the colour of the middle piece's other side. */
    const otherWayRound = (cell: number) =>
      cube[cell] === cube[faceOf(cell) === faceOf(a) ? b : a]
    return [...outers[2 * e], ...outers[2 * e + 1]].every(otherWayRound)
  })
  return edge === -1 ? null : EDGES[edge]
}
