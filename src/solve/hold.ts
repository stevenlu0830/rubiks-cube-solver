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
 * - A 4x4 has nothing that stays put: its centres move, and its solutions
 *   turn every face. So it's held by how it looks, its top, front and right
 *   just like the screen, and kept that way round. Once its centres are
 *   solved they stay put, and say which way round it is (see Checkpoint in
 *   SolveCard.tsx).
 */
export type Hold =
  | { by: 'centres'; front: Color; top: Color }
  | { by: 'corner'; down: Color; left: Color; back: Color }
  | { by: 'view' }

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
  if (puzzle.size > 2) return { by: 'view' }
  const [down, back, left] = cornerCellsOf(puzzle)[CORNERS.indexOf('DBL')].map(
    (cell) => cube[cell]!,
  )
  return { by: 'corner', down, left, back }
}
