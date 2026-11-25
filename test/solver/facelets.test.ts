import { describe, expect, it } from 'vitest'
import { applyMoves, parseMoves } from '../../src/cube/moves.ts'
import { PUZZLE_5X5 } from '../../src/cube/puzzle.ts'
import {
  centerCell,
  FACES,
  solvedState,
  STANDARD_SCHEME,
  type ColorScheme,
} from '../../src/cube/state.ts'
import { toFaceletString } from '../../src/solver/facelets.ts'

describe('toFaceletString on a 5x5', () => {
  const SOLVED_5X5 = solvedState(STANDARD_SCHEME, PUZZLE_5X5)
  const SOLVED_LETTERS = FACES.map((face) => face.repeat(25)).join('')

  it('writes a solved 5x5 as 25 of each face letter, 150 in all', () => {
    expect(toFaceletString(SOLVED_5X5)).toBe(SOLVED_LETTERS)
    expect(SOLVED_LETTERS).toHaveLength(150)
  })

  it('names faces by their fixed centres, so any colour scheme, held any way, works', () => {
    const scheme: ColorScheme = {
      U: 'blue',
      R: 'white',
      F: 'red',
      D: 'green',
      L: 'yellow',
      B: 'orange',
    }
    expect(toFaceletString(solvedState(scheme, PUZZLE_5X5))).toBe(
      SOLVED_LETTERS,
    )
    expect(toFaceletString(applyMoves(SOLVED_5X5, parseMoves("x y2 z'")))).toBe(
      SOLVED_LETTERS,
    )
  })

  it('gives each square the letter of the face whose centre is its colour', () => {
    const cube = applyMoves(SOLVED_5X5, parseMoves("R u' Fw2 l D2 b' y"))
    const letters = toFaceletString(cube)
    const faceOfColor = new Map(
      FACES.map((face) => [cube[centerCell(face, PUZZLE_5X5)], face]),
    )
    expect(letters).toHaveLength(150)
    expect([...letters]).toEqual(cube.map((color) => faceOfColor.get(color)))
    for (const face of FACES) {
      expect(letters[centerCell(face, PUZZLE_5X5)]).toBe(face)
    }
  })
})
