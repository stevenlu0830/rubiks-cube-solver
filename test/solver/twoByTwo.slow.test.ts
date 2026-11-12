import { Quaternion } from 'three'
import { beforeAll, expect, it } from 'vitest'
import { applyMoves, randomScramble } from '../../src/cube/moves.ts'
import { PUZZLE_2X2 } from '../../src/cube/puzzle.ts'
import { isSolved, solvedState, STANDARD_SCHEME } from '../../src/cube/state.ts'
import { validateCube } from '../../src/cube/validate.ts'
import { toFaceletString } from '../../src/solver/facelets.ts'
import {
  cornerNumbers,
  cornersFromFacelets,
  initTwoByTwoSolver,
  MAX_MOVES,
  PLACEMENTS,
  solverTables,
  solveTwoByTwo,
  SOLVER_MOVES,
  TWISTS,
} from '../../src/solver/twoByTwo.ts'
import type { SwipeDirection } from '../../src/view/gestures.ts'
import { cubeAsShown, turnBySwipe } from '../../src/view/orientation.ts'
import { seededRandom } from '../helpers/seededRandom.ts'

/**
 * The long checks of the 2x2 solver (`npm run test:slow`):
 * 1. Every one of the 3,674,160 ways a 2x2 can be is reached by the
 *    solver's moves, and none is more than 11 moves from solved. This
 *    walks the whole puzzle, spreading out from solved one move at a time.
 * 2. The full journey a 2x2 takes in the app, 1,000 times: scramble it,
 *    turn the view a random way, read it as shown, solve it, and check it's
 *    solved, and in exactly the fewest moves possible (found by step 1).
 */

const SWIPES: SwipeDirection[] = ['left', 'right', 'up', 'down']
const POSITIONS = PLACEMENTS * TWISTS

/** For every placement × twist: the fewest moves from solved. */
let distance: Int8Array

beforeAll(() => {
  initTwoByTwoSolver()
  const { placementMoves, twistMoves } = solverTables()
  const moves = SOLVER_MOVES.length
  distance = new Int8Array(POSITIONS).fill(-1)
  distance[0] = 0
  let frontier = new Int32Array([0])
  for (let depth = 1; frontier.length > 0; depth++) {
    const next: number[] = []
    for (const position of frontier) {
      const placement = Math.floor(position / TWISTS)
      const twist = position % TWISTS
      for (let m = 0; m < moves; m++) {
        const after =
          placementMoves[placement * moves + m] * TWISTS +
          twistMoves[twist * moves + m]
        if (distance[after] === -1) {
          distance[after] = depth
          next.push(after)
        }
      }
    }
    frontier = Int32Array.from(next)
  }
})

it('reaches all 3,674,160 positions, none more than 11 moves from solved', () => {
  const counts = Array<number>(MAX_MOVES + 2).fill(0)
  for (const d of distance) counts[d === -1 ? MAX_MOVES + 1 : d]++
  expect(counts[MAX_MOVES + 1]).toBe(0) // none unreached
  expect(counts.reduce((sum, n) => sum + n, 0)).toBe(3_674_160)
  expect(counts[MAX_MOVES]).toBeGreaterThan(0) // some really do need 11
})

it('solves 1,000 random 2x2s, whichever way they are held, in the fewest moves possible', () => {
  const random = seededRandom(2027)
  const solved = solvedState(STANDARD_SCHEME, PUZZLE_2X2)
  for (let run = 0; run < 1000; run++) {
    const cube = applyMoves(solved, randomScramble(30, random))
    const orientation = Array.from(
      { length: Math.floor(random() * 6) },
      () => SWIPES[Math.floor(random() * SWIPES.length)],
    ).reduce(turnBySwipe, new Quaternion())
    const shown = cubeAsShown(cube, orientation)
    expect(validateCube(shown).valid).toBe(true)

    const facelets = toFaceletString(shown)
    const solution = solveTwoByTwo(facelets)

    const { placement, twist } = cornerNumbers(cornersFromFacelets(facelets))
    expect(solution).toHaveLength(distance[placement * TWISTS + twist])
    expect(solution.length).toBeLessThanOrEqual(MAX_MOVES)
    expect(isSolved(applyMoves(shown, solution))).toBe(true)
  }
})
