import { cornerCellsOf, CORNERS } from '../cube/cubies.ts'
import { puzzleOf } from '../cube/puzzle.ts'
import { CENTER, cellIndex, type Color, type CubeState } from '../cube/state.ts'

/**
 * How to hold the cube for every step of its solution, so each move turns
 * the face it should. It's read from the cube as shown on screen when
 * Solve was pressed, which is how the user is asked to hold theirs.
 *
 * - A 3x3 by its centres: they never move, so the colours facing you and
 *   on top say which way round it is.
 * - A 2x2 has no centres. Its solutions only turn the top, right and front
 *   faces, so the corner at the back, bottom left never moves: it's held by
 *   that corner, and which colour of it goes where.
 */
export type Hold =
  | { by: 'centres'; front: Color; top: Color }
  | { by: 'corner'; down: Color; left: Color; back: Color }

/** How to hold this cube (fully painted, as shown on screen) while solving it. */
export function holdFor(cube: CubeState): Hold {
  const puzzle = puzzleOf(cube)
  if (puzzle.hasCenters) {
    return {
      by: 'centres',
      front: cube[cellIndex('F', CENTER)]!,
      top: cube[cellIndex('U', CENTER)]!,
    }
  }
  const [down, back, left] = cornerCellsOf(puzzle)[CORNERS.indexOf('DBL')].map(
    (cell) => cube[cell]!,
  )
  return { by: 'corner', down, left, back }
}
