import { beforeEach, describe, expect, it } from 'vitest'
import { cellIndex, type Color } from '../../src/cube/state.ts'
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
    expect(scan.sides.F!.rgb).toEqual(rgb)
    expect(scan.sides.F!.colors[0]).toBe('yellow')
    expect(scan.sides.U).toBeUndefined()
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
