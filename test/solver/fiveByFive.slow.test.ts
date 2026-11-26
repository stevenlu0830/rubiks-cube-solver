import { Quaternion } from 'three'
import { beforeAll, expect, it } from 'vitest'
import { applyMoves } from '../../src/cube/moves.ts'
import { isSolved } from '../../src/cube/state.ts'
import { validateCube } from '../../src/cube/validate.ts'
import { toFaceletString } from '../../src/solver/facelets.ts'
import {
  initFiveByFiveSolver,
  solveFiveByFive,
} from '../../src/solver/fiveByFive.ts'
import type { SwipeDirection } from '../../src/view/gestures.ts'
import { cubeAsShown, turnBySwipe } from '../../src/view/orientation.ts'
import { randomTurns, SOLVED_5X5 } from '../helpers/fiveByFive.ts'
import { seededRandom } from '../helpers/seededRandom.ts'

/**
 * The full journey a 5x5 takes in the app, 300 times: scramble it, turn
 * the view a random way, read it as shown, solve it, and check it's solved.
 * Also records the longest solution, the slowest solve and how many needed
 * the parity fix, which are printed, and checked against what the solver
 * promises.
 */

const SWIPES: SwipeDirection[] = ['left', 'right', 'up', 'down']
const RUNS = 300

let setupMs = 0
beforeAll(() => {
  const started = performance.now()
  initFiveByFiveSolver()
  setupMs = performance.now() - started
})

it(`solves ${RUNS} random 5x5s, whichever way they are held, in at most 170 moves`, () => {
  const random = seededRandom(2029)
  const lengths: number[] = []
  const times: number[] = []
  let parity = 0
  for (let run = 0; run < RUNS; run++) {
    const cube = applyMoves(SOLVED_5X5, randomTurns(120, random))
    const orientation = Array.from(
      { length: Math.floor(random() * 6) },
      () => SWIPES[Math.floor(random() * SWIPES.length)],
    ).reduce(turnBySwipe, new Quaternion())
    const shown = cubeAsShown(cube, orientation)
    expect(validateCube(shown)).toEqual({ valid: true, solved: false })

    const started = performance.now()
    const { moves, stages } = solveFiveByFive(toFaceletString(shown))
    times.push(performance.now() - started)
    lengths.push(moves.length)
    if (stages.some(({ name }) => name === 'parity')) parity++

    expect(isSolved(applyMoves(shown, moves))).toBe(true)
  }
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length
  console.log(
    `5x5: setup ${setupMs.toFixed(0)} ms; ` +
      `${average(lengths).toFixed(1)} moves on average, at most ${Math.max(...lengths)}; ` +
      `${average(times).toFixed(0)} ms on average, at most ${Math.max(...times).toFixed(0)} ms; ` +
      `parity fixed in ${parity} of ${RUNS}`,
  )
  expect(Math.max(...lengths)).toBeLessThanOrEqual(170)
  expect(Math.max(...times)).toBeLessThan(2000)
  // About half of all cubes need it.
  expect(parity / RUNS).toBeGreaterThan(0.35)
  expect(parity / RUNS).toBeLessThan(0.65)
}, 600_000)
