import Cube from 'cubejs'
import { parseMoves, type Move } from '../cube/moves.ts'

/**
 * A thin wrapper round the cubejs library, which implements Herbert
 * Kociemba's two-phase algorithm: it finds a solution of at most 22 moves for
 * any cube, usually in a few hundredths of a second, after a one-off setup.
 */

/** Builds the solver's lookup tables. Takes a second or more: call once. */
export function initSolver(): void {
  Cube.initSolver()
}

/**
 * Face turns that solve the cube described by `facelets`. The solution only
 * turns the six outer faces, never the whole cube, so it works as long as the
 * user keeps holding the cube the same way. initSolver must have run first.
 */
export function solveFacelets(facelets: string): Move[] {
  const cube = Cube.fromString(facelets)
  // cubejs answers a solved cube with moves that cancel out; nothing is clearer.
  if (cube.isSolved()) return []
  return parseMoves(cube.solve())
}
