import { CORNER_CELLS } from '../src/cube/cubies.ts'
import { applyMoves, parseMoves } from '../src/cube/moves.ts'
import { PUZZLE_2X2, PUZZLE_4X4 } from '../src/cube/puzzle.ts'
import {
  solvedState,
  STANDARD_SCHEME,
  type CubeState,
} from '../src/cube/state.ts'

/** A properly scrambled cube: the solver needs about 10 moves or more. */
export const SCRAMBLED = applyMoves(
  solvedState(),
  parseMoves("R U2 F' L D B2 R' U F2 L'"),
)

/**
 * A 2x2 scrambled by a few turns of every face. No two of its sides look
 * alike, even turned round, so scanning never mistakes one for another.
 */
export const SCRAMBLED_2X2 = applyMoves(
  solvedState(STANDARD_SCHEME, PUZZLE_2X2),
  parseMoves("R U2 F' L D B2 R' U F2"),
)

/** A 4x4 scrambled by turns of every kind: face, wide and inner-layer. */
export const SCRAMBLED_4X4 = applyMoves(
  solvedState(STANDARD_SCHEME, PUZZLE_4X4),
  parseMoves("R U2 F' Rw u2 L D Fw' r B2 Dw b2 R' U f L2"),
)

/** A cube that can't be solved: one corner turned in place, as if peeled and restuck. */
export const TWISTED_CORNER: CubeState = (() => {
  const cube = [...solvedState()]
  const [up, right, front] = CORNER_CELLS[0] // white, red, green
  cube[up] = 'green'
  cube[right] = 'white'
  cube[front] = 'red'
  return cube
})()

/**
 * Runs before the page loads, as if this cube had been painted on an
 * earlier visit: a 3x3, a 2x2 (24 cells) or a 4x4 (96 cells), each saved
 * in its own place.
 */
export function savedCube(cube: CubeState) {
  const key =
    cube.length === 24
      ? 'rubiks-cube-solver/cube-2x2'
      : cube.length === 96
        ? 'rubiks-cube-solver/cube-4x4'
        : 'rubiks-cube-solver/cube'
  localStorage.setItem(key, JSON.stringify(cube))
}
