import { describe, expect, it } from 'vitest'
import { applyMoves, parseMoves } from '../../src/cube/moves.ts'
import { FACES } from '../../src/cube/state.ts'
import {
  mergeTurns,
  solutionOf,
  turnLetters,
} from '../../src/solver/bigCube.ts'
import { randomTurns as randomFourByFourTurns } from '../helpers/fourByFour.ts'
import { randomTurns as randomFiveByFiveTurns } from '../helpers/fiveByFive.ts'
import { seededRandom } from '../helpers/seededRandom.ts'

describe('turnLetters', () => {
  it('turns a 4x4 or 5x5 written as face letters just as applyMoves would', () => {
    const random = seededRandom(407)
    for (const [size, randomTurns] of [
      [16, randomFourByFourTurns],
      [25, randomFiveByFiveTurns],
    ] as const) {
      const solved = FACES.map((face) => face.repeat(size)).join('')
      const moves = randomTurns(20, random)
      expect(turnLetters(solved, moves)).toBe(
        applyMoves([...solved], moves).join(''),
      )
    }
  })
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

  it('never changes what the moves do on a 4x4', () => {
    const random = seededRandom(406)
    const numbered = Array.from({ length: 96 }, (_, i) => i)
    for (let run = 0; run < 100; run++) {
      const moves = randomFourByFourTurns(30, random)
      expect(applyMoves(numbered, mergeTurns(moves))).toEqual(
        applyMoves(numbered, moves),
      )
    }
  })

  // A 5x5's middle layers never turn, so its R, r, l and L are all there is.
  it('never changes what the moves do on a 5x5, and never turns the whole cube', () => {
    const random = seededRandom(408)
    const numbered = Array.from({ length: 150 }, (_, i) => i)
    for (let run = 0; run < 100; run++) {
      const moves = randomFiveByFiveTurns(30, random)
      const merged = mergeTurns(moves)
      expect(applyMoves(numbered, merged)).toEqual(applyMoves(numbered, moves))
      expect(merged.some((move) => /^[xyz]/.test(move))).toBe(false)
    }
  })
})

describe('solutionOf', () => {
  it('runs the stages together, tidying each up and noting where it starts', () => {
    expect(
      solutionOf([
        { name: 'centres', moves: parseMoves('R r U') },
        { name: 'edges', moves: parseMoves("F F'") },
        { name: 'parity', moves: [] },
        { name: 'finish', moves: parseMoves("U' D") },
      ]),
    ).toEqual({
      moves: parseMoves("Rw U U' D"),
      stages: [
        { name: 'centres', start: 0 },
        { name: 'finish', start: 2 },
      ],
    })
  })
})
