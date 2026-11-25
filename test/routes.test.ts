import { describe, expect, it } from 'vitest'
import {
  hashFor,
  pageTitle,
  READY_CUBES,
  routeFromHash,
} from '../src/routes.ts'

describe('routeFromHash', () => {
  it('opens each cube at its own address: #/3x3, #/2x2, #/4x4 and #/5x5', () => {
    expect(routeFromHash('#/3x3')).toBe('3x3')
    expect(routeFromHash('#3x3')).toBe('3x3')
    expect(routeFromHash('#/2x2')).toBe('2x2')
    expect(routeFromHash('#/4x4')).toBe('4x4')
    expect(routeFromHash('#/5x5')).toBe('5x5')
  })

  it('shows the picker with no address, or one it does not know', () => {
    for (const hash of ['', '#', '#/', '#/6x6', '#/3x3/extra', '#/3X3']) {
      expect(routeFromHash(hash), hash).toBe('picker')
    }
  })

  it('reads back every address it makes', () => {
    for (const route of ['picker', '2x2', '3x3', '4x4', '5x5'] as const) {
      expect(routeFromHash(hashFor(route))).toBe(route)
    }
  })
})

describe('pageTitle', () => {
  it('names the cube on its own page', () => {
    expect(pageTitle('picker')).toBe("Rubik's Cube Solver")
    expect(pageTitle('3x3')).toBe("3x3 · Rubik's Cube Solver")
    expect(pageTitle('2x2')).toBe("2x2 · Rubik's Cube Solver")
    expect(pageTitle('4x4')).toBe("4x4 · Rubik's Cube Solver")
    expect(pageTitle('5x5')).toBe("5x5 · Rubik's Cube Solver")
  })
})

describe('READY_CUBES', () => {
  it('lists the cubes that can be solved so far: not the 5x5 yet', () => {
    expect(READY_CUBES).toEqual(['2x2', '3x3', '4x4'])
  })
})
