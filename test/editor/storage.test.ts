import { beforeEach, describe, expect, it } from 'vitest'
import { PUZZLE_2X2 } from '../../src/cube/puzzle.ts'
import {
  emptyState,
  solvedState,
  STANDARD_SCHEME,
} from '../../src/cube/state.ts'
import { loadCube, saveCube } from '../../src/editor/storage.ts'

const KEY = 'rubiks-cube-solver/cube'

/** A browser storage that always fails, like some private browsing modes. */
const brokenStorage = {
  getItem: () => {
    throw new Error('denied')
  },
  setItem: () => {
    throw new Error('denied')
  },
} as unknown as Storage

describe('saving and loading the cube', () => {
  beforeEach(() => localStorage.clear())

  it('gets back exactly what was saved', () => {
    const cube = [...solvedState()]
    cube[3] = null
    saveCube(cube)
    expect(loadCube()).toEqual(cube)
  })

  it('returns null when nothing has been saved yet', () => {
    expect(loadCube()).toBeNull()
  })

  it.each([
    ['not JSON', '{oops'],
    ['not a list', '{"cells": []}'],
    ['the wrong length', JSON.stringify(emptyState().slice(1))],
    ['an unknown colour', JSON.stringify(['purple', ...emptyState().slice(1)])],
  ])('ignores saved data that is %s', (_, raw) => {
    localStorage.setItem(KEY, raw)
    expect(loadCube()).toBeNull()
  })

  it('keeps working when the browser refuses to store anything', () => {
    expect(() => saveCube(solvedState(), brokenStorage)).not.toThrow()
    expect(loadCube(brokenStorage)).toBeNull()
  })
})

describe('saving and loading a 2x2', () => {
  beforeEach(() => localStorage.clear())
  const twoByTwo = () => {
    const cube = [...solvedState(STANDARD_SCHEME, PUZZLE_2X2)]
    cube[5] = null
    return cube
  }

  it('gets back exactly what was saved', () => {
    saveCube(twoByTwo())
    expect(loadCube(localStorage, PUZZLE_2X2)).toEqual(twoByTwo())
  })

  it('keeps it apart from the 3x3, so neither wipes the other', () => {
    const threeByThree = [...solvedState()]
    saveCube(threeByThree)
    saveCube(twoByTwo())
    expect(loadCube()).toEqual(threeByThree)
    expect(loadCube(localStorage, PUZZLE_2X2)).toEqual(twoByTwo())
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify(threeByThree))
    expect(localStorage.getItem('rubiks-cube-solver/cube-2x2')).toBe(
      JSON.stringify(twoByTwo()),
    )
  })

  it('starts blank with nothing saved, or something saved that is not 24 cells', () => {
    expect(loadCube(localStorage, PUZZLE_2X2)).toBeNull()
    localStorage.setItem(
      'rubiks-cube-solver/cube-2x2',
      JSON.stringify(emptyState()),
    )
    expect(loadCube(localStorage, PUZZLE_2X2)).toBeNull()
  })
})
