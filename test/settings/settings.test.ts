import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from '../../src/settings/settings.ts'

const KEY = 'rubiks-cube-solver/settings'

const brokenStorage = {
  getItem: () => {
    throw new Error('denied')
  },
  setItem: () => {
    throw new Error('denied')
  },
} as unknown as Storage

describe('saving and loading settings', () => {
  beforeEach(() => localStorage.clear())

  it('starts with letters off, and vibration and auto photos on', () => {
    expect(loadSettings()).toEqual({
      letters: false,
      haptics: true,
      autoPhoto: true,
    })
  })

  it('gets back exactly what was saved', () => {
    const settings = { letters: true, haptics: false, autoPhoto: false }
    saveSettings(settings)
    expect(loadSettings()).toEqual(settings)
  })

  it.each([
    ['not JSON', '{oops', DEFAULT_SETTINGS],
    ['not an object', '[true]', DEFAULT_SETTINGS],
    [
      'partly missing',
      '{"letters":true}',
      { ...DEFAULT_SETTINGS, letters: true },
    ],
    [
      'the wrong type',
      '{"letters":"yes","haptics":false}',
      { ...DEFAULT_SETTINGS, haptics: false },
    ],
  ])('uses the defaults for saved data that is %s', (_, raw, expected) => {
    localStorage.setItem(KEY, raw)
    expect(loadSettings()).toEqual(expected)
  })

  it('keeps working when the browser refuses to store anything', () => {
    expect(() => saveSettings(DEFAULT_SETTINGS, brokenStorage)).not.toThrow()
    expect(loadSettings(brokenStorage)).toEqual(DEFAULT_SETTINGS)
  })
})
