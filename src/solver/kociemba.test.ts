import Cube from 'cubejs'
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMoves, formatMoves, randomScramble } from '../cube/moves.ts'
import { isSolved, solvedState, type ColorScheme } from '../cube/state.ts'
import { seededRandom } from '../test/seededRandom.ts'
import { toFaceletString } from './facelets.ts'
import { initSolver, solveFacelets } from './kociemba.ts'

describe('toFaceletString', () => {
  it('writes a solved cube as nine of each face letter', () => {
    expect(toFaceletString(solvedState())).toBe(
      'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
    )
  })

  it('names faces by their centres, so any colour scheme works', () => {
    const scheme: ColorScheme = {
      U: 'blue',
      R: 'white',
      F: 'red',
      D: 'green',
      L: 'yellow',
      B: 'orange',
    }
    expect(toFaceletString(solvedState(scheme))).toBe(
      toFaceletString(solvedState()),
    )
  })

  it('matches cubejs for any scramble, so both agree on what every move does', () => {
    const random = seededRandom(11)
    for (let run = 0; run < 50; run++) {
      const scramble = randomScramble(25, random)
      const ours = toFaceletString(applyMoves(solvedState(), scramble))
      const theirs = new Cube().move(formatMoves(scramble)).asString()
      expect(ours).toBe(theirs)
    }
  })
})

describe('solveFacelets', () => {
  beforeAll(() => initSolver())

  it('solves scrambled cubes in at most 22 face turns', () => {
    const random = seededRandom(12)
    for (let run = 0; run < 20; run++) {
      const cube = applyMoves(solvedState(), randomScramble(25, random))
      const solution = solveFacelets(toFaceletString(cube))
      expect(solution.length).toBeLessThanOrEqual(22)
      expect(isSolved(applyMoves(cube, solution))).toBe(true)
    }
  })

  it('returns no moves for a solved cube', () => {
    expect(solveFacelets(toFaceletString(solvedState()))).toEqual([])
  })
})
