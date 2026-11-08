import { Quaternion } from 'three'
import { describe, expect, it } from 'vitest'
import { FACES, type Face } from '../cube/state.ts'
import { allOrientations } from '../test/orientations.ts'
import type { SwipeDirection } from '../view/gestures.ts'
import { frontFace, turnBySwipe } from '../view/orientation.ts'
import { rgbToLab, type Rgb } from './colorSpace.ts'
import { nextSideTurns, sideColors, turnInstruction } from './sides.ts'

const START = new Quaternion()
const turn = (orientation: Quaternion, swipes: SwipeDirection[]) =>
  swipes.reduce(turnBySwipe, orientation)

describe('sideColors', () => {
  const side = (rgb: Rgb) => Array(9).fill(rgbToLab(rgb))

  it('names the colours of the side asked for', () => {
    const sides = { F: side([0, 155, 72]), U: side([255, 255, 255]) }
    expect(sideColors(sides, 'U')).toEqual(Array(9).fill('white'))
    expect(sideColors(sides, 'F')).toEqual(Array(9).fill('green'))
  })

  it('uses the other sides: two centres are never the same colour', () => {
    const redOrange = side([230, 80, 30])
    expect(sideColors({ U: redOrange }, 'U')[4]).toBe('orange')
    expect(sideColors({ F: side([240, 105, 25]), U: redOrange }, 'U')[4]).toBe(
      'red',
    )
  })
})

describe('nextSideTurns', () => {
  it('stays put while the side in front still needs scanning', () => {
    expect(nextSideTurns(START, new Set())).toEqual([])
  })

  it('turns left first: easier than tipping the cube', () => {
    expect(nextSideTurns(START, new Set(['F']))).toEqual(['left'])
  })

  it('has nothing left once all six sides are scanned', () => {
    expect(nextSideTurns(START, new Set(FACES))).toBeNull()
  })

  it('goes to a side next to the front before the one opposite', () => {
    // Only the top, bottom and back are left: the back is two turns away.
    const scanned = new Set<Face>(['F', 'R', 'L'])
    expect(nextSideTurns(START, scanned)).toEqual(['down'])
  })

  it('turns the cube around when only the back is left', () => {
    const scanned = new Set<Face>(['F', 'R', 'L', 'U', 'D'])
    expect(nextSideTurns(START, scanned)).toEqual(['left', 'left'])
  })

  it('visits all six sides in five quarter turns, however the cube starts', () => {
    for (let orientation of allOrientations()) {
      const scanned = new Set([frontFace(orientation)])
      let quarterTurns = 0
      for (let swipes; (swipes = nextSideTurns(orientation, scanned));) {
        orientation = turn(orientation, swipes)
        quarterTurns += swipes.length
        expect(scanned.has(frontFace(orientation))).toBe(false)
        scanned.add(frontFace(orientation))
      }
      expect(scanned.size).toBe(6)
      expect(quarterTurns).toBe(5)
    }
  })

  it('picks up from wherever the user swiped to', () => {
    // Scanned the front, then swiped down to the top and scanned it too.
    const orientation = turn(START, ['down'])
    const swipes = nextSideTurns(orientation, new Set(['F', 'U']))!
    expect(swipes).toHaveLength(1)
    expect(['F', 'U']).not.toContain(frontFace(turn(orientation, swipes)))
  })
})

describe('turnInstruction', () => {
  it.each<[SwipeDirection[], string]>([
    [['left'], 'Turn your cube to the left, so its right side faces you'],
    [['right'], 'Turn your cube to the right, so its left side faces you'],
    [
      ['up'],
      'Tip the top of your cube away from you, so its bottom side faces you',
    ],
    [
      ['down'],
      'Tip the top of your cube towards you, so its top side faces you',
    ],
    [['left', 'left'], 'Turn your cube around, so its back side faces you'],
    [
      ['left', 'down'],
      'Turn your cube to the left, then tip the top of your cube towards you',
    ],
  ])('%j: %s', (swipes, text) => {
    expect(turnInstruction(swipes)).toBe(text)
  })

  it('matches the side the swipes bring to the front', () => {
    const named: Record<string, Face> = {
      right: 'R',
      left: 'L',
      bottom: 'D',
      top: 'U',
      back: 'B',
    }
    for (const swipes of [
      ['left'],
      ['right'],
      ['up'],
      ['down'],
      ['left', 'left'],
    ] as SwipeDirection[][]) {
      const side = turnInstruction(swipes).match(/its (\w+) side/)![1]
      expect(frontFace(turn(START, swipes))).toBe(named[side])
    }
  })
})
