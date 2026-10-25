import { beforeEach, describe, expect, it } from 'vitest'
import { emptyState, solvedState } from '../cube/state.ts'
import { loadCube, saveCube } from './storage.ts'

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
