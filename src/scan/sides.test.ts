import { Quaternion } from 'three'
import { describe, expect, it } from 'vitest'
import { CENTER, cellIndex, FACES, type Face } from '../cube/state.ts'
import { allOrientations } from '../test/orientations.ts'
import type { SwipeDirection } from '../view/gestures.ts'
import { frontFace, turnBySwipe } from '../view/orientation.ts'
import { rgbToLab, type Rgb } from './colorSpace.ts'
import {
  nextSideTurns,
  readScannedCube,
  repeatedSide,
  turnInstruction,
  type ScannedSide,
} from './sides.ts'

const START = new Quaternion()
const turn = (orientation: Quaternion, swipes: SwipeDirection[]) =>
  swipes.reduce(turnBySwipe, orientation)

/**
 * A side photographed onto `face`, in its usual order: the first squares in
 * these colours, and the rest in the last one.
 */
function photo(face: Face, ...colors: Rgb[]): ScannedSide {
  const rgb = Array.from({ length: 9 }, (_, n) => colors[n] ?? colors.at(-1)!)
  return {
    cells: Array.from({ length: 9 }, (_, n) => cellIndex(face, n)),
    rgb,
    readings: rgb.map(rgbToLab),
  }
}

const GREEN: Rgb = [0, 155, 72]
const WHITE: Rgb = [255, 255, 255]
const RED: Rgb = [183, 18, 52]
const ORANGE: Rgb = [255, 88, 0]
const REDDISH_ORANGE: Rgb = [215, 60, 45] // an orange that looks red on its own

describe('readScannedCube', () => {
  it('names every scanned square, by cell', () => {
    const read = readScannedCube({ F: photo('F', GREEN), U: photo('U', WHITE) })
    expect(read.size).toBe(18)
    expect(read.get(cellIndex('U', 0))).toEqual({
      color: 'white',
      unsure: false,
    })
    expect(read.get(cellIndex('F', 8))?.color).toBe('green')
  })

  it('never names two centres the same colour', () => {
    const redOrange: Rgb = [230, 80, 30]
    const read = readScannedCube({
      F: photo('F', [240, 105, 25]),
      U: photo('U', redOrange),
    })
    expect(read.get(cellIndex('U', CENTER))?.color).toBe('red')
  })

  it('can change an earlier side when a new one comes in', () => {
    // The front has two reddish oranges; with only it scanned, they're red.
    const front = photo(
      'F',
      REDDISH_ORANGE,
      REDDISH_ORANGE,
      GREEN,
      GREEN,
      GREEN,
    )
    const before = readScannedCube({ F: front })
    expect(before.get(cellIndex('F', 0))?.color).toBe('red')
    // Then the red side: 9 clear reds. Red is full, so those two are orange.
    const after = readScannedCube({ F: front, R: photo('R', RED) })
    expect(after.get(cellIndex('F', 0))?.color).toBe('orange')
    expect(after.get(cellIndex('F', 1))?.color).toBe('orange')
  })

  it('never changes a square fixed by hand', () => {
    const front = photo(
      'F',
      REDDISH_ORANGE,
      REDDISH_ORANGE,
      GREEN,
      GREEN,
      GREEN,
    )
    const fixes = { [cellIndex('F', 0)]: 'yellow' as const }
    const read = readScannedCube({ F: front, R: photo('R', RED) }, fixes)
    expect(read.get(cellIndex('F', 0))).toEqual({
      color: 'yellow',
      unsure: false,
    })
  })
})

describe('repeatedSide', () => {
  it('spots a second photo of a side already scanned', () => {
    const sides = { F: photo('F', GREEN), R: photo('R', GREEN) }
    expect(repeatedSide(sides, 'R')).toBe('F')
  })

  it('finds nothing for different sides, or the first side', () => {
    expect(repeatedSide({ F: photo('F', GREEN) }, 'F')).toBeNull()
    const sides = { F: photo('F', GREEN), R: photo('R', RED) }
    expect(repeatedSide(sides, 'R')).toBeNull()
  })

  it("doesn't mistake orange for the red side", () => {
    const sides = { F: photo('F', RED), R: photo('R', ORANGE) }
    expect(repeatedSide(sides, 'R')).toBeNull()
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
