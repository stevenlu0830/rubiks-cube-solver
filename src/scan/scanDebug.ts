/**
 * The hidden ?scan-debug mode (add ?scan-debug to the address). It records
 * what the camera read from each side, with the colours you ended up with
 * after fixing any by hand, so photos of a real cube in real light can be
 * kept as test data. See src/scan/test-photos/README.md.
 */

import { FACES, type Color, type Face } from '../cube/state.ts'
import { classifySides, type Classified } from './classify.ts'
import { rgbToLab, type Rgb } from './colorSpace.ts'
import type { ScannedSides } from './sides.ts'

export const LIGHTS = [
  'daylight',
  'warm bulb',
  'dim',
  'phone torch',
  'other',
] as const
export type Light = (typeof LIGHTS)[number]

/** One side: the camera's 9 colours, and what they really are, in photo order. */
export interface RecordedSide {
  rgb: Rgb[]
  colors: Color[]
}

/** One scan of a cube, from Scan to Done. */
export interface RecordedScan {
  /** When it started, which also tells scans apart. */
  id: string
  light: Light
  sides: Partial<Record<Face, RecordedSide>>
}

export function isScanDebug(search: string = location.search): boolean {
  return new URLSearchParams(search).has('scan-debug')
}

/** A scan as it stands: every side so far, with the colours as now named. */
export function recordScan(
  id: string,
  light: Light,
  sides: ScannedSides,
  named: ReadonlyMap<number, Classified>,
): RecordedScan {
  const recorded: RecordedScan['sides'] = {}
  for (const face of FACES) {
    const side = sides[face]
    if (!side) continue
    recorded[face] = {
      rgb: [...side.rgb],
      colors: side.cells.map((cell) => named.get(cell)!.color),
    }
  }
  return { id, light, sides: recorded }
}

const STORAGE_KEY = 'rubiks-cube-solver/scan-debug'

/** The scans recorded on this device. Storage can be missing or full; then there are none. */
export function loadRecordedScans(
  storage: Storage = localStorage,
): RecordedScan[] {
  try {
    const saved: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(saved) ? (saved as RecordedScan[]) : []
  } catch {
    return []
  }
}

/** Saves a scan, replacing the earlier save of the same scan. */
export function saveRecordedScan(
  scan: RecordedScan,
  storage: Storage = localStorage,
): void {
  const others = loadRecordedScans(storage).filter(({ id }) => id !== scan.id)
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify([...others, scan]))
  } catch {
    // Not saved: this is only a debugging aid.
  }
}

export function clearRecordedScans(storage: Storage = localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear.
  }
}

/** A square the app names differently from the recorded answer. */
export interface Misread {
  scan: string
  light: Light
  face: Face
  /** Which of the side's 9 squares, row by row from the top left. */
  square: number
  expected: Color
  got: Color
}

/**
 * Names the colours of recorded scans afresh, as the app would now (with no
 * fixes by hand), and lists every square it gets wrong.
 */
export function checkRecordedScans(scans: readonly RecordedScan[]): {
  squares: number
  misreads: Misread[]
} {
  let squares = 0
  const misreads: Misread[] = []
  for (const scan of scans) {
    const faces = FACES.filter((face) => scan.sides[face])
    const named = classifySides(
      faces.map((face) => scan.sides[face]!.rgb.map(rgbToLab)),
    )
    faces.forEach((face, i) => {
      scan.sides[face]!.colors.forEach((expected, square) => {
        squares++
        const got = named[i][square].color
        if (got !== expected) {
          misreads.push({
            scan: scan.id,
            light: scan.light,
            face,
            square,
            expected,
            got,
          })
        }
      })
    })
  }
  return { squares, misreads }
}
