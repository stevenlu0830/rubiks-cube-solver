import { beforeEach, describe, expect, it } from 'vitest'
import { applyMoves, parseMoves } from '../../src/cube/moves.ts'
import { PUZZLE_2X2 } from '../../src/cube/puzzle.ts'
import {
  cellIndex,
  FACES,
  solvedState,
  STANDARD_SCHEME,
  type Color,
} from '../../src/cube/state.ts'
import { STICKER_COLORS } from '../../src/view/colors.ts'
import type { Classified } from '../../src/scan/classify.ts'
import { rgbToLab, type Rgb } from '../../src/scan/colorSpace.ts'
import {
  checkRecordedScans,
  clearRecordedScans,
  isScanDebug,
  loadRecordedScans,
  recordScan,
  saveRecordedScan,
  type RecordedScan,
} from '../../src/scan/scanDebug.ts'

const GREEN: Rgb = [0, 155, 72]
const WHITE: Rgb = [255, 255, 255]

describe('isScanDebug', () => {
  it('is on only with ?scan-debug in the address', () => {
    expect(isScanDebug('?scan-debug')).toBe(true)
    expect(isScanDebug('?fps&scan-debug')).toBe(true)
    expect(isScanDebug('')).toBe(false)
    expect(isScanDebug('?fps')).toBe(false)
  })
})

describe('recordScan', () => {
  it('keeps what the camera read and the colours as named, side by side', () => {
    const cells = Array.from({ length: 9 }, (_, n) => cellIndex('F', n))
    const rgb = Array<Rgb>(9).fill(GREEN)
    const named = new Map<number, Classified>(
      cells.map((cell) => [cell, { color: 'green', unsure: false }]),
    )
    named.set(cells[0], { color: 'yellow', unsure: false }) // fixed by hand
    const scan = recordScan(
      'scan-1',
      'dim',
      { F: { cells, rgb, readings: rgb.map(rgbToLab) } },
      named,
    )
    expect(scan.light).toBe('dim')
    expect(scan.cube).toBe('3x3')
    expect(scan.sides.F!.rgb).toEqual(rgb)
    expect(scan.sides.F!.colors[0]).toBe('yellow')
    expect(scan.sides.F!.cells).toEqual(cells)
    expect(scan.sides.U).toBeUndefined()
  })

  it('says which cube was scanned', () => {
    const cells = [0, 1, 2, 3].map((n) => cellIndex('F', n, PUZZLE_2X2))
    const rgb = Array<Rgb>(4).fill(GREEN)
    const named = new Map<number, Classified>(
      cells.map((cell) => [cell, { color: 'green', unsure: false }]),
    )
    const scan = recordScan(
      'scan-2',
      'daylight',
      { F: { cells, rgb, readings: rgb.map(rgbToLab) } },
      named,
    )
    expect(scan.cube).toBe('2x2')
    expect(scan.sides.F!.colors).toEqual(Array(4).fill('green'))
  })
})

describe('saved scans', () => {
  beforeEach(() => localStorage.clear())
  const scan = (id: string): RecordedScan => ({
    id,
    light: 'daylight',
    sides: {},
  })

  it('saves, replaces by id, and clears', () => {
    saveRecordedScan(scan('a'))
    saveRecordedScan(scan('b'))
    saveRecordedScan({ ...scan('a'), light: 'dim' })
    expect(loadRecordedScans().map(({ id, light }) => [id, light])).toEqual([
      ['b', 'daylight'],
      ['a', 'dim'],
    ])
    clearRecordedScans()
    expect(loadRecordedScans()).toEqual([])
  })

  it('treats unreadable storage as no scans', () => {
    localStorage.setItem('rubiks-cube-solver/scan-debug', '{oops')
    expect(loadRecordedScans()).toEqual([])
  })
})

describe('checkRecordedScans', () => {
  it('lists the squares the app now names differently from the recording', () => {
    const colors = Array<Color>(9).fill('green')
    colors[3] = 'blue' // recorded as blue, but it reads green
    const scans: RecordedScan[] = [
      {
        id: 'scan-1',
        light: 'warm bulb',
        sides: {
          F: { rgb: Array(9).fill(GREEN), colors },
          U: { rgb: Array(9).fill(WHITE), colors: Array(9).fill('white') },
        },
      },
    ]
    expect(checkRecordedScans(scans)).toEqual({
      squares: 18,
      misreads: [
        {
          scan: 'scan-1',
          cube: '3x3', // recorded before 2x2s could be scanned
          light: 'warm bulb',
          face: 'F',
          square: 3,
          expected: 'blue',
          got: 'green',
        },
      ],
    })
  })
})

describe('checkRecordedScans on a 2x2', () => {
  const SCRAMBLED_2X2 = applyMoves(
    solvedState(STANDARD_SCHEME, PUZZLE_2X2),
    parseMoves("R U2 F' L D B2 R' U F2"),
  )
  const brand = (color: Color): Rgb =>
    [1, 3, 5].map((i) =>
      parseInt(STICKER_COLORS[color].slice(i, i + 2), 16),
    ) as unknown as Rgb

  /** A full scan of the 2x2, with a red and an orange that look like each other. */
  function recorded({ withCells }: { withCells: boolean }): RecordedScan {
    const red = SCRAMBLED_2X2.indexOf('red')
    const orange = SCRAMBLED_2X2.indexOf('orange')
    const sides: RecordedScan['sides'] = {}
    for (const face of FACES) {
      const cells = [0, 1, 2, 3].map((n) => cellIndex(face, n, PUZZLE_2X2))
      sides[face] = {
        rgb: cells.map((cell) =>
          cell === red
            ? [228, 78, 32]
            : cell === orange
              ? [205, 48, 45]
              : brand(SCRAMBLED_2X2[cell]!),
        ),
        colors: cells.map((cell) => SCRAMBLED_2X2[cell]!),
        ...(withCells ? { cells } : {}),
      }
    }
    return { id: 'scan-2x2', cube: '2x2', light: 'warm bulb', sides }
  }

  it('names the squares exactly as the app does, settling close calls too', () => {
    expect(checkRecordedScans([recorded({ withCells: true })])).toEqual({
      squares: 24,
      misreads: [],
    })
  })

  it('names the colours alone for a scan recorded without its cells', () => {
    const { squares, misreads } = checkRecordedScans([
      recorded({ withCells: false }),
    ])
    expect(squares).toBe(24)
    expect(
      misreads.map(({ cube, expected, got }) => [cube, expected, got]),
    ).toEqual(
      expect.arrayContaining([
        ['2x2', 'red', 'orange'],
        ['2x2', 'orange', 'red'],
      ]),
    )
  })
})
