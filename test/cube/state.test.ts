import { describe, expect, it } from 'vitest'
import { PUZZLE_2X2 } from '../../src/cube/puzzle.ts'
import {
  cellIndex,
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
