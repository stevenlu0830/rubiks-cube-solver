import { describe, expect, it } from 'vitest'
import {
  PUZZLE_2X2,
  PUZZLE_3X3,
  PUZZLE_4X4,
  PUZZLE_5X5,
} from '../../src/cube/puzzle.ts'
import {
  cellIndex,
  centerCell,
  centerOf,
  colorCounts,
  COLORS,
  emptyState,
  isSolved,
  solvedState,
  STANDARD_SCHEME,
} from '../../src/cube/state.ts'

describe('cell layout', () => {
  it('numbers faces in U R F D L B order, 9 cells each', () => {
    expect(cellIndex('U', 0)).toBe(0)
    expect(cellIndex('R', 0)).toBe(9)
    expect(cellIndex('F', 4)).toBe(22)
    expect(cellIndex('B', 8)).toBe(53)
  })
})

describe('centerOf', () => {
  it("is the middle square of a face that has one: 4 of a 3x3's 9, 12 of a 5x5's 25", () => {
    expect(centerOf()).toBe(4)
    expect(centerOf(PUZZLE_3X3)).toBe(4)
    expect(centerOf(PUZZLE_5X5)).toBe(12)
  })

  it('refuses a 2x2 or 4x4, which have no centre square that stays put', () => {
    expect(() => centerOf(PUZZLE_2X2)).toThrow('A 2x2 has no centre square')
    expect(() => centerOf(PUZZLE_4X4)).toThrow('A 4x4 has no centre square')
  })
})

describe('centerCell', () => {
  it("is each face's centre square: U4, R4… on a 3x3, U12, R12… on a 5x5", () => {
    expect(centerCell('U')).toBe(4)
    expect(centerCell('R')).toBe(13)
    expect(centerCell('B')).toBe(49)
    expect(centerCell('U', PUZZLE_5X5)).toBe(12)
    expect(centerCell('R', PUZZLE_5X5)).toBe(37)
    expect(centerCell('B', PUZZLE_5X5)).toBe(137)
  })
})

describe('emptyState', () => {
  it('has 54 unpainted cells', () => {
    const state = emptyState()
    expect(state).toHaveLength(54)
    expect(state.every((cell) => cell === null)).toBe(true)
  })
})

describe('solvedState', () => {
  it('paints each face in its scheme colour', () => {
    const state = solvedState()
    expect(state).toHaveLength(54)
    expect(state[cellIndex('U', 0)]).toBe(STANDARD_SCHEME.U)
    expect(state[cellIndex('F', 8)]).toBe(STANDARD_SCHEME.F)
    expect(state[cellIndex('B', 4)]).toBe(STANDARD_SCHEME.B)
  })
})

describe('isSolved', () => {
  it('is true for a solved cube', () => {
    expect(isSolved(solvedState())).toBe(true)
  })

  it('is false for an unpainted cube', () => {
    expect(isSolved(emptyState())).toBe(false)
  })

  it('is false when a single cell differs', () => {
    const state = [...solvedState()]
    state[cellIndex('F', 0)] = 'red'
    expect(isSolved(state)).toBe(false)
  })
})

describe('on a 2x2', () => {
  it('numbers faces in U R F D L B order, 4 cells each', () => {
    expect(cellIndex('U', 0, PUZZLE_2X2)).toBe(0)
    expect(cellIndex('R', 0, PUZZLE_2X2)).toBe(4)
    expect(cellIndex('F', 3, PUZZLE_2X2)).toBe(11)
    expect(cellIndex('B', 3, PUZZLE_2X2)).toBe(23)
  })

  it('starts with 24 unpainted cells', () => {
    const state = emptyState(PUZZLE_2X2)
    expect(state).toHaveLength(24)
    expect(state.every((cell) => cell === null)).toBe(true)
  })

  it('is solved with each face one colour: 4 of each', () => {
    const solved = solvedState(STANDARD_SCHEME, PUZZLE_2X2)
    expect(solved).toHaveLength(24)
    expect(isSolved(solved)).toBe(true)
    for (const color of COLORS) expect(colorCounts(solved)[color]).toBe(4)
    expect(solved.slice(0, 4)).toEqual(Array(4).fill(STANDARD_SCHEME.U))
    expect(solved.slice(20)).toEqual(Array(4).fill(STANDARD_SCHEME.B))
  })

  it('is not solved with a blank cell, or one cell a different colour', () => {
    const solved = solvedState(STANDARD_SCHEME, PUZZLE_2X2)
    for (const changed of [null, 'yellow'] as const) {
      const cube = [...solved]
      cube[cellIndex('F', 2, PUZZLE_2X2)] = changed
      expect(isSolved(cube)).toBe(false)
    }
    expect(isSolved(emptyState(PUZZLE_2X2))).toBe(false)
  })
})

describe('on a 5x5', () => {
  it('numbers faces in U R F D L B order, 25 cells each', () => {
    expect(cellIndex('U', 0, PUZZLE_5X5)).toBe(0)
    expect(cellIndex('R', 0, PUZZLE_5X5)).toBe(25)
    expect(cellIndex('F', 12, PUZZLE_5X5)).toBe(62)
    expect(cellIndex('B', 24, PUZZLE_5X5)).toBe(149)
  })

  it('starts with 150 unpainted cells', () => {
    const state = emptyState(PUZZLE_5X5)
    expect(state).toHaveLength(150)
    expect(state.every((cell) => cell === null)).toBe(true)
  })

  it('is solved with each face one colour: 25 of each', () => {
    const solved = solvedState(STANDARD_SCHEME, PUZZLE_5X5)
    expect(isSolved(solved)).toBe(true)
    for (const color of COLORS) expect(colorCounts(solved)[color]).toBe(25)
    const cube = [...solved]
    cube[cellIndex('L', 24, PUZZLE_5X5)] = 'white'
    expect(isSolved(cube)).toBe(false)
  })
})
