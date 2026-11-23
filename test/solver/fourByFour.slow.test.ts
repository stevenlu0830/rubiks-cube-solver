import { Quaternion } from 'three'
import { beforeAll, expect, it } from 'vitest'
import { applyMoves } from '../../src/cube/moves.ts'
import { PUZZLE_4X4 } from '../../src/cube/puzzle.ts'
import { isSolved, solvedState, STANDARD_SCHEME } from '../../src/cube/state.ts'
import { validateCube } from '../../src/cube/validate.ts'
import { toFaceletString } from '../../src/solver/facelets.ts'
import {
  initFourByFourSolver,
  solveFourByFour,
} from '../../src/solver/fourByFour.ts'
import type { SwipeDirection } from '../../src/view/gestures.ts'
import { cubeAsShown, turnBySwipe } from '../../src/view/orientation.ts'
import { randomTurns } from '../helpers/fourByFour.ts'
import { seededRandom } from '../helpers/seededRandom.ts'

/**
 * The full journey a 4x4 takes in the app, 1,000 times: scramble it, turn
 * the view a random way, read it as shown, solve it, and check it's solved.
 * Also records the longest solution and the slowest solve, which are
 * printed, and checked against what the solver promises.
 */

const SWIPES: SwipeDirection[] = ['left', 'right', 'up', 'down']

beforeAll(() => initFourByFourSolver())

it('solves 1,000 random 4x4s, whichever way they are held, in at most 110 moves', () => {
  const random = seededRandom(2028)
  const lengths: number[] = []
  const times: number[] = []
  for (let run = 0; run < 1000; run++) {
    const cube = applyMoves(
      solvedState(STANDARD_SCHEME, PUZZLE_4X4),
      randomTurns(80, random),
    )
    const orientation = Array.from(
      { length: Math.floor(random() * 6) },
      () => SWIPES[Math.floor(random() * SWIPES.length)],
    ).reduce(turnBySwipe, new Quaternion())
    const shown = cubeAsShown(cube, orientation)
    expect(validateCube(shown)).toEqual({ valid: true, solved: false })

    const started = performance.now()
    const { moves } = solveFourByFour(toFaceletString(shown))
    times.push(performance.now() - started)
    lengths.push(moves.length)

    expect(isSolved(applyMoves(shown, moves))).toBe(true)
  }
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length
  console.log(
    `4x4: ${average(lengths).toFixed(1)} moves on average, at most ${Math.max(...lengths)}; ` +
      `${average(times).toFixed(0)} ms on average, at most ${Math.max(...times).toFixed(0)} ms`,
  )
  expect(Math.max(...lengths)).toBeLessThanOrEqual(110)
  expect(Math.max(...times)).toBeLessThan(2000)
})
