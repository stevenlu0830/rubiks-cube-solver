import { describe, expect, it, vi } from 'vitest'
import {
  perPuzzle,
  PUZZLE_2X2,
  PUZZLE_3X3,
  PUZZLES,
  puzzleOf,
  puzzleOfSide,
} from '../../src/cube/puzzle.ts'

describe('PUZZLES', () => {
  it('describes a 3x3: 9 squares a face, 54 in all, 9 of each colour, with centres', () => {
    expect(PUZZLE_3X3).toEqual({
      name: '3x3',
      size: 3,
      cellsPerFace: 9,
      cellCount: 54,
      cellsPerColor: 9,
      hasCenters: true,
    })
  })

  it('describes a 2x2: 4 squares a face, 24 in all, 4 of each colour, no centres', () => {
    expect(PUZZLE_2X2).toEqual({
      name: '2x2',
      size: 2,
      cellsPerFace: 4,
      cellCount: 24,
      cellsPerColor: 4,
      hasCenters: false,
    })
  })

  it('finds each by its name', () => {
    expect(PUZZLES['2x2']).toBe(PUZZLE_2X2)
    expect(PUZZLES['3x3']).toBe(PUZZLE_3X3)
  })
})

describe('puzzleOf', () => {
  it('tells the cube from how many cells it has', () => {
    expect(puzzleOf(Array(54))).toBe(PUZZLE_3X3)
    expect(puzzleOf(Array(24))).toBe(PUZZLE_2X2)
  })

  it('refuses any other number of cells', () => {
    expect(() => puzzleOf(Array(53))).toThrow('No cube has 53 cells')
    expect(() => puzzleOf([])).toThrow()
  })
})

describe('puzzleOfSide', () => {
  it("tells the cube from one side's squares", () => {
    expect(puzzleOfSide(Array(9))).toBe(PUZZLE_3X3)
    expect(puzzleOfSide(Array(4))).toBe(PUZZLE_2X2)
    expect(() => puzzleOfSide(Array(5))).toThrow()
  })
})

describe('perPuzzle', () => {
  it('works each table out once per puzzle, then reuses it', () => {
    const make = vi.fn((puzzle: { cellCount: number }) => ({
      cells: puzzle.cellCount,
    }))
    const tableOf = perPuzzle(make)
    const first = tableOf(PUZZLE_2X2)
    expect(tableOf(PUZZLE_2X2)).toBe(first)
    expect(tableOf(PUZZLE_3X3)).toEqual({ cells: 54 })
    expect(tableOf(PUZZLE_3X3)).toBe(tableOf(PUZZLE_3X3))
    expect(make).toHaveBeenCalledTimes(2)
  })
})
