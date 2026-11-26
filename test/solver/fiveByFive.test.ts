import { beforeAll, describe, expect, it } from 'vitest'
import { wingCellsOf } from '../../src/cube/cubies.ts'
import { applyMoves, parseMoves, type Move } from '../../src/cube/moves.ts'
import { PUZZLE_5X5 } from '../../src/cube/puzzle.ts'
import { isSolved, type CubeState } from '../../src/cube/state.ts'
import { validateCube } from '../../src/cube/validate.ts'
import { toFaceletString } from '../../src/solver/facelets.ts'
import {
  EDGE_FIX,
  initFiveByFiveSolver,
  solveFiveByFive,
} from '../../src/solver/fiveByFive.ts'
import { FLIP_FIX } from '../../src/solver/fourByFour.ts'
import type { Stage } from '../../src/solver/protocol.ts'
import {
  asThreeByThree,
  centresSolved,
  edgesJoined,
  randomTurns,
  SOLVED_5X5,
} from '../helpers/fiveByFive.ts'
import { seededRandom } from '../helpers/seededRandom.ts'

beforeAll(() => initFiveByFiveSolver())

/** Solves the cube as painted, checking the solution really does solve it. */
function solve(cube: CubeState) {
  const solution = solveFiveByFive(toFaceletString(cube))
  expect(isSolved(applyMoves(cube, solution.moves))).toBe(true)
  return solution
}

/** The moves of each stage, by name. */
function movesByStage(moves: readonly Move[], stages: readonly Stage[]) {
  return Object.fromEntries(
    stages.map(({ name, start }, i) => [
      name,
      moves.slice(start, stages[i + 1]?.start),
    ]),
  )
}

/** The cube with one edge's two outer pieces swapped round: real on a 5x5. */
function withOuterPiecesSwapped(edge: number): CubeState {
  const cube = [...SOLVED_5X5]
  const [[a1, b1], [a2, b2]] = wingCellsOf(PUZZLE_5X5).slice(
    2 * edge,
    2 * edge + 2,
  )
  // A piece keeps its colours in the order wingCellsOf lists its slot's
  // cells, wherever it goes, so each takes the other's colours in order.
  ;[cube[a1], cube[b1], cube[a2], cube[b2]] = [
    SOLVED_5X5[a2],
    SOLVED_5X5[b2],
    SOLVED_5X5[a1],
    SOLVED_5X5[b1],
  ]
  return cube
}

describe('solveFiveByFive', () => {
  it('needs no moves for a solved cube', () => {
    expect(solveFiveByFive(toFaceletString(SOLVED_5X5))).toEqual({
      moves: [],
      stages: [],
    })
  })

  it.each(['R', "Rw'", 'r2', 'u', "F2 b'", 'Dw l', "r U2 r'"])(
    'solves a cube a move or two from solved (%s) in a few moves',
    (scramble) => {
      const { moves } = solve(applyMoves(SOLVED_5X5, parseMoves(scramble)))
      expect(moves.length).toBeLessThanOrEqual(25)
    },
  )

  it('solves 5 scrambled cubes in at most 170 moves, never turning the whole cube', () => {
    const random = seededRandom(505)
    for (let run = 0; run < 5; run++) {
      const { moves } = solve(applyMoves(SOLVED_5X5, randomTurns(100, random)))
      expect(moves.length).toBeLessThanOrEqual(170)
      expect(moves.some((move) => /^[xyz]/.test(move))).toBe(false)
    }
  })

  it('goes through the stages in order, each finishing its job: centres, then edges, then a 3x3 with nothing swapped', () => {
    const random = seededRandom(506)
    for (let run = 0; run < 4; run++) {
      const cube = applyMoves(SOLVED_5X5, randomTurns(100, random))
      const { moves, stages } = solve(cube)
      expect(stages.map(({ name }) => name)).toEqual(
        ['centres', 'edges', 'parity', 'finish'].filter((name) =>
          stages.some((stage) => stage.name === name),
        ),
      )
      expect(stages[0]).toEqual({ name: 'centres', start: 0 })
      stages.forEach(({ start }, i) => {
        if (i > 0) expect(start).toBeGreaterThan(stages[i - 1].start)
      })

      const after = (name: string) => {
        const end = stages.findIndex((stage) => stage.name === name) + 1
        return applyMoves(cube, moves.slice(0, stages[end]?.start))
      }
      expect(centresSolved(after('centres'))).toBe(true)
      const joined = stages.some(({ name }) => name === 'parity')
        ? after('parity')
        : after('edges')
      expect(centresSolved(joined)).toBe(true)
      expect(edgesJoined(joined)).toBe(true)
      expect(validateCube(asThreeByThree(joined)).valid).toBe(true)
    }
  })

  it('fixes parity in some cubes and not others, leaving the last edge for the fix with its outer pieces swapped', () => {
    const random = seededRandom(507)
    const needed = Array.from({ length: 6 }, () => {
      const cube = applyMoves(SOLVED_5X5, randomTurns(100, random))
      const { moves, stages } = solve(cube)
      const parity = stages.find(({ name }) => name === 'parity')
      if (parity) {
        const beforeFix = applyMoves(cube, moves.slice(0, parity.start))
        expect(edgesJoined(beforeFix)).toBe(false)
        expect(
          edgesJoined(
            applyMoves(beforeFix, movesByStage(moves, stages).parity),
          ),
        ).toBe(true)
      }
      return parity !== undefined
    })
    expect(needed).toContain(true)
    expect(needed).toContain(false)
  })

  // The fix undoes itself, so it's all a cube scrambled by it needs.
  it('swaps back the outer pieces of the top front edge with the edge fix', () => {
    const { moves, stages } = solve(applyMoves(SOLVED_5X5, EDGE_FIX))
    expect(stages).toEqual([{ name: 'parity', start: 0 }])
    expect(moves).toEqual(EDGE_FIX)
  })

  it.each(Array.from({ length: 12 }, (_, edge) => edge))(
    'swaps back the outer pieces of edge %i, wherever it is, in one go',
    (edge) => {
      const cube = withOuterPiecesSwapped(edge)
      expect(validateCube(cube)).toEqual({ valid: true, solved: false })
      const { moves, stages } = solve(cube)
      expect(stages[0]).toEqual({ name: 'parity', start: 0 })
      expect(movesByStage(moves, stages).parity).toHaveLength(EDGE_FIX.length)
    },
  )

  it('refuses anything that is not 150 face letters', () => {
    expect(() => solveFiveByFive('U'.repeat(96))).toThrow('Not a 5x5 cube')
    expect(() => solveFiveByFive('X'.repeat(150))).toThrow('Not a 5x5 cube')
  })

  it("gives up with an error, rather than going on for ever, on a cube that can't be solved", () => {
    // One corner turned in place: the check before solving catches this.
    const twisted = [...SOLVED_5X5]
    const [up, right, front] = [24, 25, 54] // white, red, green at the front right
    ;[twisted[up], twisted[right], twisted[front]] = [
      SOLVED_5X5[front],
      SOLVED_5X5[up],
      SOLVED_5X5[right],
    ]
    expect(validateCube(twisted).valid).toBe(false)
    expect(() => solveFiveByFive(toFaceletString(twisted))).toThrow()
  })
})

describe('the edge fix', () => {
  it("is the 4x4's flip fix turning inner layers only", () => {
    expect(EDGE_FIX).toEqual(
      FLIP_FIX.map((move) =>
        move.replace(/^([RL])w/, (_, face: string) => face.toLowerCase()),
      ),
    )
  })

  it("swaps the top front edge's outer pieces, and changes nothing else on a cube with its centres solved", () => {
    expect(applyMoves(SOLVED_5X5, EDGE_FIX)).toEqual(withOuterPiecesSwapped(1))
  })
})
