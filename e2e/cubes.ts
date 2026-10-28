import { CORNER_CELLS } from '../src/cube/cubies.ts'
import { applyMoves, parseMoves } from '../src/cube/moves.ts'
import { solvedState, type CubeState } from '../src/cube/state.ts'

/** A properly scrambled cube: the solver needs about 10 moves or more. */
export const SCRAMBLED = applyMoves(
  solvedState(),
  parseMoves("R U2 F' L D B2 R' U F2 L'"),
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

/** Runs before the page loads, as if this cube had been painted on an earlier visit. */
export function savedCube(cube: CubeState) {
  localStorage.setItem('rubiks-cube-solver/cube', JSON.stringify(cube))
}
