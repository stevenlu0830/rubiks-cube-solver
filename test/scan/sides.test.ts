import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { applyMoves, parseMoves } from '../../src/cube/moves.ts'
import { PUZZLE_2X2 } from '../../src/cube/puzzle.ts'
import {
  CENTER,
  cellIndex,
  COLORS,
  FACES,
  solvedState,
  STANDARD_SCHEME,
  type Color,
  type CubeState,
  type Face,
} from '../../src/cube/state.ts'
import { validateCube } from '../../src/cube/validate.ts'
import { STICKER_COLORS } from '../../src/view/colors.ts'
import { allOrientations } from '../helpers/orientations.ts'
import type { SwipeDirection } from '../../src/view/gestures.ts'
import {
  faceTowards,
  frontFace,
  turnBySwipe,
} from '../../src/view/orientation.ts'
import { classifySides } from '../../src/scan/classify.ts'
import { rgbToLab, type Rgb } from '../../src/scan/colorSpace.ts'
import {
  nextSideTurns,
  readScannedCube,
  repeatedSide,
  turnInstruction,
  type ScannedSide,
  type ScannedSides,
} from '../../src/scan/sides.ts'
import { findTurnedSides, turnCells } from '../../src/scan/turnedSides.ts'

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
    expect(read.get(cellIndex('U', 0))).toMatchObject({
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

  it('has nothing to name before the first photo', () => {
    expect(readScannedCube({}).size).toBe(0)
  })
})

describe('on a 2x2', () => {
  const SCRAMBLED_2X2 = applyMoves(
    solvedState(STANDARD_SCHEME, PUZZLE_2X2),
    parseMoves("R U2 F' L D B2 R' U F2"),
  )
  const BRAND = Object.fromEntries(
    COLORS.map((color) => {
      const hex = STICKER_COLORS[color]
      return [color, [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))]
    }),
  ) as unknown as Record<Color, Rgb>
  const cellsOf = (face: Face) =>
    [0, 1, 2, 3].map((n) => cellIndex(face, n, PUZZLE_2X2))

  /**
   * Photos of every side of `cube` (each held as the 3D one, except the
   * sides in `turned`), each square read as `readAs` says, or its colour.
   */
  function scanOf(
    cube: CubeState,
    {
      readAs = {},
      turned = {},
    }: {
      readAs?: Record<number, Rgb>
      turned?: Partial<Record<Face, number>>
    } = {},
  ): ScannedSides {
    const sides: ScannedSides = {}
    for (const face of FACES) {
      const cells = cellsOf(face)
      const rgb = turnCells(cells, turned[face] ?? 0).map(
        (cell) => readAs[cell] ?? BRAND[cube[cell]!],
      )
      sides[face] = { cells, rgb, readings: rgb.map(rgbToLab) }
    }
    return sides
  }
  const colorsOf = (named: ReturnType<typeof readScannedCube>) =>
    Array.from({ length: 24 }, (_, cell) => named.get(cell)!.color)

  it('names every square of a full scan, by cell', () => {
    expect(colorsOf(readScannedCube(scanOf(SCRAMBLED_2X2)))).toEqual(
      SCRAMBLED_2X2,
    )
  })

  it('settles a red and an orange read the wrong way round, once all six sides are in', () => {
    // An orange-looking red, and a red-looking orange: "4 of each" is happy
    // either way, but read as they look, two corners can't be real.
    const red = SCRAMBLED_2X2.indexOf('red')
    const orange = SCRAMBLED_2X2.indexOf('orange')
    const readAs = { [red]: [228, 78, 32], [orange]: [205, 48, 45] } as Record<
      number,
      Rgb
    >
    const scan = scanOf(SCRAMBLED_2X2, { readAs })
    // Named from the photos alone, they come out the wrong way round…
    const alone = classifySides(FACES.map((face) => scan[face]!.readings))
    expect(alone.flat()[red].color).toBe('orange')
    expect(alone.flat()[orange].color).toBe('red')

    // …which the check before solving puts right.
    const named = readScannedCube(scan)
    expect(colorsOf(named)).toEqual(SCRAMBLED_2X2)
    expect(named.get(red)?.unsure).toBe(true)
    expect(named.get(orange)?.unsure).toBe(true)
  })

  it('leaves a side photographed turned for the turned-side fix', () => {
    const scan = scanOf(SCRAMBLED_2X2, { turned: { L: 1 } })
    const named = readScannedCube(scan)
    // Every square named as photographed, so turning the side back fixes it.
    expect(validateCube(colorsOf(named)).valid).toBe(false)
    expect(findTurnedSides(scan, named)).toEqual({ L: 1 })
  })

  it('is quick enough to run on every look through the camera', () => {
    // The worst case: a twisted corner, which no search can fix.
    const [up, right, front] = [
      cellIndex('U', 3, PUZZLE_2X2),
      cellIndex('R', 0, PUZZLE_2X2),
      cellIndex('F', 1, PUZZLE_2X2),
    ]
    const readAs = {
      [up]: BRAND[SCRAMBLED_2X2[right]!],
      [right]: BRAND[SCRAMBLED_2X2[front]!],
      [front]: BRAND[SCRAMBLED_2X2[up]!],
    }
    const scan = scanOf(SCRAMBLED_2X2, { readAs })
    const start = performance.now()
    readScannedCube(scan)
    expect(performance.now() - start).toBeLessThan(150)
  })

  describe('repeatedSide', () => {
    const scan = scanOf(SCRAMBLED_2X2)

    it('spots a second photo of a side, held any way round', () => {
      for (const turns of [0, 1, 2, 3]) {
        const again = turnCells(scan.F!.rgb, turns)
        const sides = {
          F: scan.F,
          R: { ...scan.R!, rgb: again, readings: again.map(rgbToLab) },
        }
        expect(repeatedSide(sides, 'R'), `${turns} turns`).toBe('F')
      }
    })

    it('finds nothing for a different side', () => {
      expect(repeatedSide({ F: scan.F, R: scan.R }, 'R')).toBeNull()
    })

    it('finds nothing when one square is a different colour', () => {
      const rgb = [...scan.F!.rgb]
      rgb[3] = rgb[3] === BRAND.red ? BRAND.orange : BRAND.red
      const sides = {
        F: scan.F,
        R: { ...scan.R!, rgb, readings: rgb.map(rgbToLab) },
      }
      expect(repeatedSide(sides, 'R')).toBeNull()
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

  it.each<[SwipeDirection[], string]>([
    [
      ['left'],
      'Turn your cube to the left, so the side on your left faces the camera',
    ],
    [
      ['right'],
      'Turn your cube to the right, so the side on your right faces the camera',
    ],
    [
      ['up'],
      'Tip the top of your cube towards you, so its bottom side faces the camera',
    ],
    [
      ['down'],
      'Tip the top of your cube away from you, so its top side faces the camera',
    ],
    [
      ['left', 'left'],
      'Turn your cube around, so the side facing you faces the camera',
    ],
    [
      ['left', 'down'],
      'Turn your cube to the left, then tip the top of your cube away from you',
    ],
  ])('with a camera facing you, %j: %s', (swipes, text) => {
    expect(turnInstruction(swipes, { facingYou: true })).toBe(text)
  })

  describe('with a camera facing you, like a laptop', () => {
    /**
     * The real cube is the 3D one seen from behind: turned half round, so
     * the 3D cube's front faces the camera, away from the user.
     */
    const HALF_ROUND = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.PI,
    )
    const realCube = (shown: Quaternion) => HALF_ROUND.clone().multiply(shown)
    const TOWARDS_CAMERA = new Vector3(0, 0, -1)
    /** What each instruction asks the user to do with their hands, as swipes. */
    const MOVES: [RegExp, SwipeDirection[]][] = [
      [/turn your cube to the left/i, ['left']],
      [/turn your cube to the right/i, ['right']],
      [/tip the top of your cube away from you/i, ['up']],
      [/tip the top of your cube towards you/i, ['down']],
      [/turn your cube around/i, ['left', 'left']],
    ]
    const SEQUENCES: SwipeDirection[][] = [
      ['left'],
      ['right'],
      ['up'],
      ['down'],
      ['left', 'left'],
      ['right', 'up'],
    ]

    it('keeps the real cube matching the 3D one, from any start', () => {
      for (const shown of allOrientations()) {
        for (const swipes of SEQUENCES) {
          const text = turnInstruction(swipes, { facingYou: true })
          const hands = text
            .split(', then ')
            .flatMap((step) => MOVES.find(([words]) => words.test(step))![1])
          const real = hands.reduce(turnBySwipe, realCube(shown))
          const expected = realCube(turn(shown, swipes))
          expect(real.angleTo(expected), text).toBeLessThan(1e-6)
        }
      }
    })

    it('names the side that comes round to the camera', () => {
      const where: Record<string, Vector3> = {
        'the side on your left': new Vector3(-1, 0, 0),
        'the side on your right': new Vector3(1, 0, 0),
        'its bottom side': new Vector3(0, -1, 0),
        'its top side': new Vector3(0, 1, 0),
        'the side facing you': new Vector3(0, 0, 1),
      }
      for (const swipes of SEQUENCES.slice(0, 5)) {
        const text = turnInstruction(swipes, { facingYou: true })
        const side = text.match(/so (.+) faces the camera/)![1]
        const before = realCube(START)
        const after = realCube(turn(START, swipes))
        expect(faceTowards(after, TOWARDS_CAMERA), text).toBe(
          faceTowards(before, where[side]),
        )
      }
    })
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
