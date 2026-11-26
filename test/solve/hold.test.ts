import { Quaternion } from 'three'
import { describe, expect, it } from 'vitest'
import {
  applyMove,
  applyMoves,
  movesOf,
  parseMoves,
  randomScramble,
} from '../../src/cube/moves.ts'
import { PUZZLE_2X2, PUZZLE_4X4, PUZZLE_5X5 } from '../../src/cube/puzzle.ts'
import {
  cellIndex,
  FACES,
  solvedState,
  STANDARD_SCHEME,
  type CubeState,
  type Face,
} from '../../src/cube/state.ts'
import { holdFor } from '../../src/solve/hold.ts'
import { toFaceletString } from '../../src/solver/facelets.ts'
import { solveTwoByTwo, SOLVER_MOVES } from '../../src/solver/twoByTwo.ts'
import { cubeAsShown, turnBySwipe } from '../../src/view/orientation.ts'
import { allOrientations } from '../helpers/orientations.ts'
import { seededRandom } from '../helpers/seededRandom.ts'

/** Turned so the right side faces you (red, on a cube held the usual way). */
const RIGHT_IN_FRONT = turnBySwipe(new Quaternion(), 'left')

describe('holdFor', () => {
  describe('a 3x3', () => {
    const scrambled = applyMoves(solvedState(), parseMoves("R U2 F' L D B2"))

    it('is held by the centres facing you and on top', () => {
      expect(holdFor(scrambled)).toEqual({
        by: 'centres',
        front: 'green',
        top: 'white',
      })
    })

    it('is held the way it is shown on screen', () => {
      expect(holdFor(cubeAsShown(scrambled, RIGHT_IN_FRONT))).toEqual({
        by: 'centres',
        front: 'red',
        top: 'white',
      })
    })

    it('stays the same through every face turn: centres never move', () => {
      for (const face of FACES) {
        expect(holdFor(applyMove(scrambled, face))).toEqual(holdFor(scrambled))
      }
    })
  })

  describe('a 2x2', () => {
    const SOLVED_2X2 = solvedState(STANDARD_SCHEME, PUZZLE_2X2)
    const scrambled = applyMoves(SOLVED_2X2, parseMoves("R U2 F' L D B2"))

    it('is held by the corner at the back, bottom left, and which colour goes where', () => {
      expect(holdFor(SOLVED_2X2)).toEqual({
        by: 'corner',
        down: 'yellow',
        left: 'orange',
        back: 'blue',
      })
    })

    it('is held the way it is shown on screen', () => {
      // Right side in front: green is on the left, orange at the back.
      expect(holdFor(cubeAsShown(SOLVED_2X2, RIGHT_IN_FRONT))).toEqual({
        by: 'corner',
        down: 'yellow',
        left: 'green',
        back: 'orange',
      })
    })

    it('stays the same through any U, R or F turn: none moves that corner', () => {
      for (const move of SOLVER_MOVES) {
        expect(holdFor(applyMove(scrambled, move))).toEqual(holdFor(scrambled))
      }
    })

    it("is the corner the 2x2 solver keeps still: solved, each face is that corner's colour", () => {
      const random = seededRandom(4)
      const orientations = allOrientations()
      const faceColor = (cube: CubeState, face: Face) =>
        new Set(
          Array.from(
            { length: 4 },
            (_, n) => cube[cellIndex(face, n, PUZZLE_2X2)],
          ),
        )
      for (let run = 0; run < 24; run++) {
        const cube = applyMoves(SOLVED_2X2, randomScramble(20, random))
        const shown = cubeAsShown(cube, orientations[run])
        const hold = holdFor(shown)
        if (hold.by !== 'corner') throw new Error('Held by the wrong thing')

        const solved = applyMoves(shown, solveTwoByTwo(toFaceletString(shown)))
        expect(faceColor(solved, 'D')).toEqual(new Set([hold.down]))
        expect(faceColor(solved, 'L')).toEqual(new Set([hold.left]))
        expect(faceColor(solved, 'B')).toEqual(new Set([hold.back]))
      }
    })
  })

  describe('a 4x4', () => {
    it('is held by how it looks: nothing on it stays put to say which way round it is', () => {
      const cube = applyMoves(
        solvedState(STANDARD_SCHEME, PUZZLE_4X4),
        parseMoves("Rw U2 f' L"),
      )
      expect(holdFor(cube)).toEqual({ by: 'view' })
      expect(holdFor(cubeAsShown(cube, RIGHT_IN_FRONT))).toEqual({ by: 'view' })
    })
  })

  describe('a 5x5', () => {
    const scrambled = applyMoves(
      solvedState(STANDARD_SCHEME, PUZZLE_5X5),
      parseMoves("Rw U2 f' L r2 D"),
    )

    it('is held by its centres, like a 3x3: they never move', () => {
      expect(holdFor(scrambled)).toEqual({
        by: 'centres',
        front: 'green',
        top: 'white',
      })
      expect(holdFor(cubeAsShown(scrambled, RIGHT_IN_FRONT))).toEqual({
        by: 'centres',
        front: 'red',
        top: 'white',
      })
    })

    it('stays the same through every face, wide and inner-layer turn: none turns the middle layers', () => {
      const turns = movesOf(PUZZLE_5X5).filter((move) => !/^[xyz]/.test(move))
      for (const move of turns) {
        expect(holdFor(applyMove(scrambled, move))).toEqual(holdFor(scrambled))
      }
    })
  })
})
