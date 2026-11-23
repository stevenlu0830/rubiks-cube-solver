import { beforeAll, describe, expect, it } from 'vitest'
import { applyMoves, parseMoves, type Move } from '../../src/cube/moves.ts'
import { PUZZLE_4X4 } from '../../src/cube/puzzle.ts'
import {
  isSolved,
  solvedState,
  STANDARD_SCHEME,
  type CubeState,
} from '../../src/cube/state.ts'
import { validateCube } from '../../src/cube/validate.ts'
import { toFaceletString } from '../../src/solver/facelets.ts'
import {
  FLIP_FIX,
  initFourByFourSolver,
  mergeTurns,
  solveFourByFour,
  SWAP_FIX,
} from '../../src/solver/fourByFour.ts'
import type { Stage } from '../../src/solver/protocol.ts'
import {
  asThreeByThree,
  centresSolved,
  edgesPaired,
  randomTurns,
} from '../helpers/fourByFour.ts'
import { seededRandom } from '../helpers/seededRandom.ts'

const SOLVED_4X4 = solvedState(STANDARD_SCHEME, PUZZLE_4X4)

beforeAll(() => initFourByFourSolver())

/** Solves the cube as painted, checking the solution really does solve it. */
function solve(cube: CubeState) {
  const solution = solveFourByFour(toFaceletString(cube))
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

describe('toFaceletString on a 4x4', () => {
  it('gives each of the 96 squares the letter of the face its colour belongs on', () => {
    expect(toFaceletString(SOLVED_4X4)).toBe(
      'U'.repeat(16) +
        'R'.repeat(16) +
        'F'.repeat(16) +
        'D'.repeat(16) +
        'L'.repeat(16) +
        'B'.repeat(16),
    )
  })

  it('reads a solved cube as solved however it was painted round, by the corner at the back, bottom left', () => {
    for (const turns of ['x', "y z'", 'x2 y']) {
      expect(toFaceletString(applyMoves(SOLVED_4X4, parseMoves(turns)))).toBe(
        toFaceletString(SOLVED_4X4),
      )
    }
  })
})

describe('solveFourByFour', () => {
  it('needs no moves for a solved cube', () => {
    expect(solveFourByFour(toFaceletString(SOLVED_4X4))).toEqual({
      moves: [],
      stages: [],
    })
  })

  it.each(['R', "Rw'", 'r2', 'u', "F2 b'", 'Dw l'])(
    'solves a cube a move or two from solved (%s) in a few moves',
    (scramble) => {
      const { moves } = solve(applyMoves(SOLVED_4X4, parseMoves(scramble)))
      expect(moves.length).toBeLessThanOrEqual(20)
    },
  )

  it('solves 20 scrambled cubes in at most 110 moves, never turning the whole cube', () => {
    const random = seededRandom(404)
    for (let run = 0; run < 20; run++) {
      const { moves } = solve(applyMoves(SOLVED_4X4, randomTurns(60, random)))
      expect(moves.length).toBeLessThanOrEqual(110)
      expect(moves.some((move) => /^[xyz]/.test(move))).toBe(false)
    }
  })

  it('goes through the stages in order, each finishing its job: centres, then edges, then a 3x3 with no parity', () => {
    const random = seededRandom(405)
    for (let run = 0; run < 10; run++) {
      const cube = applyMoves(SOLVED_4X4, randomTurns(60, random))
      const { moves, stages } = solve(cube)
      expect(stages.map(({ name }) => name)).toEqual(
        ['centres', 'edges', 'parity', 'finish'].filter((name) =>
          stages.some((stage) => stage.name === name),
        ),
      )
      expect(stages[0].start).toBe(0)
      stages.forEach(({ start }, i) => {
        if (i > 0) expect(start).toBeGreaterThan(stages[i - 1].start)
      })

      const after = (name: string) => {
        const end = stages.findIndex((stage) => stage.name === name) + 1
        return applyMoves(cube, moves.slice(0, stages[end]?.start))
      }
      expect(centresSolved(after('centres'))).toBe(true)
      expect(edgesPaired(after('edges'))).toBe(true)
      expect(centresSolved(after('edges'))).toBe(true)
      const parityFixed = stages.some(({ name }) => name === 'parity')
        ? after('parity')
        : after('edges')
      expect(validateCube(asThreeByThree(parityFixed)).valid).toBe(true)
    }
  })

  // Each fix undoes itself, so it's all a cube scrambled by it needs.
  it('fixes a flipped edge with the flip fix', () => {
    const { moves, stages } = solve(applyMoves(SOLVED_4X4, FLIP_FIX))
    expect(stages).toEqual([{ name: 'parity', start: 0 }])
    expect(moves).toEqual(FLIP_FIX)
  })

  it('fixes two swapped edges with the swap fix', () => {
    const { moves, stages } = solve(applyMoves(SOLVED_4X4, SWAP_FIX))
    expect(stages).toEqual([{ name: 'parity', start: 0 }])
    expect(moves).toEqual(SWAP_FIX)
  })

  it('fixes a flipped edge and then finishes, when there is more to do', () => {
    const { moves, stages } = solve(
      applyMoves(SOLVED_4X4, [...FLIP_FIX, ...parseMoves("R U'")]),
    )
    expect(stages.map(({ name }) => name)).toEqual(['parity', 'finish'])
    expect(movesByStage(moves, stages).parity).toEqual(FLIP_FIX)
  })

  it('fixes both at once', () => {
    const cube = applyMoves(SOLVED_4X4, [...SWAP_FIX, ...FLIP_FIX])
    const { moves, stages } = solve(cube)
    expect(movesByStage(moves, stages).parity).toEqual(
      mergeTurns([...FLIP_FIX, ...SWAP_FIX]),
    )
  })

  it('refuses anything that is not 96 face letters', () => {
    expect(() => solveFourByFour('U'.repeat(54))).toThrow('Not a 4x4 cube')
    expect(() => solveFourByFour('X'.repeat(96))).toThrow('Not a 4x4 cube')
  })

  it("gives up with an error, rather than going on for ever, on a cube that can't be solved", () => {
    // One corner turned in place: the check before solving catches this.
    const twisted = [...SOLVED_4X4]
    const [up, right, front] = [15, 16, 35] // white, red, green at the front right
    ;[twisted[up], twisted[right], twisted[front]] = [
      SOLVED_4X4[front],
      SOLVED_4X4[up],
      SOLVED_4X4[right],
    ]
    expect(validateCube(twisted).valid).toBe(false)
    expect(() => solveFourByFour(toFaceletString(twisted))).toThrow()
  })
})

describe('the parity fixes', () => {
  it.each([
    ['flip', FLIP_FIX],
    ['swap', SWAP_FIX],
  ] as const)(
    'keep the centres and pairs, leaving a 3x3 with a %s problem',
    (problem, fix) => {
      const cube = applyMoves(SOLVED_4X4, fix)
      expect(centresSolved(cube)).toBe(true)
      expect(edgesPaired(cube)).toBe(true)
      const result = validateCube(asThreeByThree(cube))
      expect(result.valid ? null : result.problem).toBe(problem)
    },
  )
})

describe('mergeTurns', () => {
  it.each([
    ['R r', 'Rw'],
    ["U U'", ''],
    ['F2 F', "F'"],
    ["Rw R'", 'r'],
    ['L l', 'Lw'],
    ["u2 U2 u2 U'", 'U'],
    ["R L R'", 'L'],
    ["r l'", "r l'"],
    ["R U R'", "R U R'"],
    ["U R R' U'", ''],
  ])('%s → %s', (moves, merged) => {
    expect(mergeTurns(parseMoves(moves))).toEqual(parseMoves(merged))
  })

  it('never changes what the moves do', () => {
    const random = seededRandom(406)
    const numbered = Array.from({ length: 96 }, (_, i) => i)
    for (let run = 0; run < 100; run++) {
      const moves = randomTurns(30, random)
      expect(applyMoves(numbered, mergeTurns(moves))).toEqual(
        applyMoves(numbered, moves),
      )
    }
  })
})
