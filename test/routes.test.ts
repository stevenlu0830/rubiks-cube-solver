import { describe, expect, it } from 'vitest'
import { hashFor, pageTitle, routeFromHash } from '../src/routes.ts'

describe('routeFromHash', () => {
  it('opens the 3x3 solver at #/3x3', () => {
    expect(routeFromHash('#/3x3')).toBe('3x3')
    expect(routeFromHash('#3x3')).toBe('3x3')
  })

  it('shows the picker with no address, or one it does not know', () => {
    for (const hash of ['', '#', '#/', '#/4x4', '#/3x3/extra', '#/3X3']) {
      expect(routeFromHash(hash), hash).toBe('picker')
    }
  })

  it('shows the picker for the 2x2 until it can be solved', () => {
    expect(routeFromHash('#/2x2')).toBe('picker')
  })

  it('reads back every address it makes', () => {
    for (const route of ['picker', '3x3'] as const) {
      expect(routeFromHash(hashFor(route))).toBe(route)
    }
  })
})

describe('pageTitle', () => {
  it('names the cube on its own page', () => {
    expect(pageTitle('picker')).toBe("Rubik's Cube Solver")
    expect(pageTitle('3x3')).toBe("3x3 · Rubik's Cube Solver")
  })
})
