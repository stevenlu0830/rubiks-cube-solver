import { Quaternion } from 'three'
import { beforeAll, expect, it } from 'vitest'
import { applyMoves, randomScramble } from '../../src/cube/moves.ts'
import { isSolved, solvedState } from '../../src/cube/state.ts'
import { validateCube } from '../../src/cube/validate.ts'
import { seededRandom } from '../helpers/seededRandom.ts'
import type { SwipeDirection } from '../../src/view/gestures.ts'
import { cubeAsShown, turnBySwipe } from '../../src/view/orientation.ts'
import { toFaceletString } from '../../src/solver/facelets.ts'
import { initSolver, solveFacelets } from '../../src/solver/kociemba.ts'

/**
 * The full journey a cube takes in the app, 1,000 times: scramble it, turn
 * the view a random way, read it as shown on screen, solve it, apply the
 * solution, and check it's solved. Takes about half a minute, so it runs with
 * `npm run test:slow` rather than the everyday `npm test`.
 */

const SWIPES: SwipeDirection[] = ['left', 'right', 'up', 'down']
const FACE_TURN = /^[URFDLB]['2]?$/

beforeAll(() => initSolver())

it('solves 1,000 random cubes, whichever way they are held', () => {
  const random = seededRandom(2026)
  for (let run = 0; run < 1000; run++) {
    const cube = applyMoves(solvedState(), randomScramble(30, random))
    const orientation = Array.from(
      { length: Math.floor(random() * 6) },
      () => SWIPES[Math.floor(random() * SWIPES.length)],
    ).reduce(turnBySwipe, new Quaternion())
    const shown = cubeAsShown(cube, orientation)
    expect(validateCube(shown)).toEqual({ valid: true, solved: false })

    const solution = solveFacelets(toFaceletString(shown))

    expect(solution.length).toBeLessThanOrEqual(22)
    // Only face turns: the user never has to turn the whole cube round.
    expect(solution.every((move) => FACE_TURN.test(move))).toBe(true)
    expect(isSolved(applyMoves(shown, solution))).toBe(true)
  }
})
