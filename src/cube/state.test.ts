import { describe, expect, it } from 'vitest'
import {
  cellIndex,
  emptyState,
  isSolved,
  solvedState,
  STANDARD_SCHEME,
} from './state.ts'

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
