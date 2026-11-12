import { Quaternion } from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  applyMoves,
  formatMoves,
  invertMoves,
  parseMoves,
  randomScramble,
  type Move,
} from '../../src/cube/moves.ts'
import { PUZZLE_2X2 } from '../../src/cube/puzzle.ts'
import {
  isSolved,
  solvedState,
  STANDARD_SCHEME,
  type CubeState,
} from '../../src/cube/state.ts'
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

const SOLVED_2X2 = solvedState(STANDARD_SCHEME, PUZZLE_2X2)
const SOLVED_LETTERS = 'UUUURRRRFFFFDDDDLLLLBBBB'
const SWIPES: SwipeDirection[] = ['left', 'right', 'up', 'down']

/** Solves a painted 2x2 the way the app does: letters, then the solver. */
const solve = (cube: CubeState) => solveTwoByTwo(toFaceletString(cube))

/** Random turns of the top, right and front faces only. */
function scrambleURF(length: number, random: () => number): Move[] {
  const moves: Move[] = []
  while (moves.length < length) {
    const move = SOLVER_MOVES[Math.floor(random() * SOLVER_MOVES.length)]
    if (moves.at(-1)?.[0] !== move[0]) moves.push(move)
  }
  return moves
}

beforeAll(() => initTwoByTwoSolver())

describe('solveTwoByTwo', () => {
  it('needs no moves for a solved cube', () => {
    expect(solveTwoByTwo(SOLVED_LETTERS)).toEqual([])
  })

  it.each(SOLVER_MOVES)('undoes a single %s in one move', (move) => {
    expect(solve(applyMoves(SOLVED_2X2, [move]))).toEqual(invertMoves([move]))
  })

  it('never takes more moves than the scramble, for short scrambles', () => {
    const random = seededRandom(5)
    for (let run = 0; run < 200; run++) {
      const scramble = scrambleURF(1 + Math.floor(random() * 6), random)
      const cube = applyMoves(SOLVED_2X2, scramble)
      const solution = solve(cube)
      expect(solution.length, formatMoves(scramble)).toBeLessThanOrEqual(
        scramble.length,
      )
      expect(isSolved(applyMoves(cube, solution))).toBe(true)
    }
  })

  it("solves R U R' U' in 4 moves, and never turns a face twice running", () => {
    const solution = solve(applyMoves(SOLVED_2X2, parseMoves("R U R' U'")))
    expect(solution).toHaveLength(4)
    solution.slice(1).forEach((move, i) => {
      expect(move[0]).not.toBe(solution[i][0])
    })
  })

  it('solves 100 cubes scrambled with every face and held any way, with top, right and front turns', () => {
    const random = seededRandom(11)
    for (let run = 0; run < 100; run++) {
      const cube = applyMoves(SOLVED_2X2, randomScramble(25, random))
      const orientation = Array.from(
        { length: Math.floor(random() * 6) },
        () => SWIPES[Math.floor(random() * SWIPES.length)],
      ).reduce(turnBySwipe, new Quaternion())
      const shown = cubeAsShown(cube, orientation)
      expect(validateCube(shown).valid).toBe(true)

      const solution = solve(shown)
      expect(solution.length).toBeLessThanOrEqual(MAX_MOVES)
      expect(solution.every((move) => /^[URF]['2]?$/.test(move))).toBe(true)
      expect(isSolved(applyMoves(shown, solution))).toBe(true)
    }
  })

  it('refuses letters that are not a real 2x2', () => {
    expect(() => solveTwoByTwo('UUUU')).toThrow('Not a 2x2 cube')
    expect(() => solveTwoByTwo(`${SOLVED_LETTERS.slice(0, 23)}X`)).toThrow()
    // A corner turned in place: U and F swapped, then R and U, round URF.
    const twisted = [...SOLVED_LETTERS]
    ;[twisted[3], twisted[4], twisted[9]] = ['F', 'U', 'R']
    expect(() => solveTwoByTwo(twisted.join(''))).toThrow('twisted')
  })

  it('refuses a cube whose back-bottom-left corner is not the one in place', () => {
    // Turning the back face moves that corner; the app always picks the
    // colours so it's in place (see colorsKeepingCorner).
    const letters = applyMoves([...SOLVED_LETTERS], ['B']).join('')
    expect(() => solveTwoByTwo(letters)).toThrow('back-bottom-left')
  })
})

describe('cornersFromFacelets', () => {
  it('reads a solved cube as every corner in place and untwisted', () => {
    expect(cornersFromFacelets(SOLVED_LETTERS)).toEqual({
      cp: [0, 1, 2, 3, 4, 5, 6, 7],
      co: [0, 0, 0, 0, 0, 0, 0, 0],
    })
    expect(cornerNumbers(cornersFromFacelets(SOLVED_LETTERS))).toEqual({
      placement: 0,
      twist: 0,
    })
  })
})

describe('solverTables', () => {
  it('has a lookup table of 5,040 placements and one of 729 twists', () => {
    const tables = solverTables()
    expect(tables.placementDistance).toHaveLength(PLACEMENTS)
    expect(tables.twistDistance).toHaveLength(TWISTS)
    expect(tables.placementMoves).toHaveLength(PLACEMENTS * 9)
    expect(tables.twistMoves).toHaveLength(TWISTS * 9)
  })

  it('can reach every placement and twist, and none needs more than 11 moves', () => {
    const { placementDistance, twistDistance } = solverTables()
    for (const distances of [placementDistance, twistDistance]) {
      expect(Math.min(...distances)).toBe(0) // none left unreached (-1)
      expect(Math.max(...distances)).toBeLessThanOrEqual(MAX_MOVES)
      expect(distances.filter((d) => d === 0)).toHaveLength(1) // only solved
    }
  })
})

describe('toFaceletString on a 2x2', () => {
  it('names each face by its colour when solved', () => {
    expect(toFaceletString(SOLVED_2X2)).toBe(SOLVED_LETTERS)
  })

  it('takes the colours from the back-bottom-left corner, so a solved cube held any way reads as solved', () => {
    for (const turns of ['x', 'y', "z'", 'x2 y', "y' z2"]) {
      const held = applyMoves(SOLVED_2X2, parseMoves(turns))
      expect(toFaceletString(held)).toBe(SOLVED_LETTERS)
    }
  })
})
