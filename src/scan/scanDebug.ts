/**
 * The hidden ?scan-debug mode (add ?scan-debug to the address). It records
 * what the camera read from each side, with the colours you ended up with
 * after fixing any by hand, so photos of a real cube in real light can be
 * kept as test data. See test/scan/test-photos/README.md.
 */

import { puzzleOfSide, type CubeType } from '../cube/puzzle.ts'
import { FACES, type Color, type Face } from '../cube/state.ts'
import { classifySides, type Classified } from './classify.ts'
import { rgbToLab, type Rgb } from './colorSpace.ts'
import { readScannedCube, type ScannedSides } from './sides.ts'

export const LIGHTS = [
  'daylight',
  'warm bulb',
  'dim',
  'phone torch',
  'other',
] as const
export type Light = (typeof LIGHTS)[number]

/**
 * One side: the camera's colours (9 on a 3x3, 4 on a 2x2), and what they
 * really are, in photo order.
 */
export interface RecordedSide {
  rgb: Rgb[]
  colors: Color[]
  /**
   * The cells each square went on (see ScannedSide). Missing from scans
   * recorded before they were kept.
   */
  cells?: number[]
}

/** One scan of a cube, from Scan to Done. */
export interface RecordedScan {
  /** When it started, which also tells scans apart. */
  id: string
  /** Missing from scans recorded before 2x2s could be scanned: those are all 3x3s. */
  cube?: CubeType
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
  let cube: CubeType = '3x3'
  for (const face of FACES) {
    const side = sides[face]
    if (!side) continue
    cube = puzzleOfSide(side.cells).name
    recorded[face] = {
      rgb: [...side.rgb],
      colors: side.cells.map((cell) => named.get(cell)!.color),
      cells: [...side.cells],
    }
  }
  return { id, cube, light, sides: recorded }
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
  cube: CubeType
  light: Light
  face: Face
  /** Which of the side's squares, row by row from the top left. */
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
    const named = nameAfresh(scan.sides, faces)
    faces.forEach((face, i) => {
      scan.sides[face]!.colors.forEach((expected, square) => {
        squares++
        const got = named[i][square]
        if (got !== expected) {
          misreads.push({
            scan: scan.id,
            cube: scan.cube ?? '3x3',
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

/**
 * The colours the app names recorded sides now, in photo order. With the
 * cells each square went on, it's exactly what the app does (on a 2x2 that
 * includes settling close calls with the check before solving); older
 * recordings without them get the colours named, without that step.
 */
function nameAfresh(
  recordedSides: RecordedScan['sides'],
  faces: readonly Face[],
): Color[][] {
  const recorded = faces.map((face) => recordedSides[face]!)
  if (recorded.every(({ cells }) => cells)) {
    const sides: ScannedSides = {}
    faces.forEach((face, i) => {
      const { rgb, cells } = recorded[i]
      sides[face] = { cells: cells!, rgb, readings: rgb.map(rgbToLab) }
    })
    const named = readScannedCube(sides)
    return recorded.map(({ cells }) =>
      cells!.map((cell) => named.get(cell)!.color),
    )
  }
  return classifySides(recorded.map(({ rgb }) => rgb.map(rgbToLab))).map(
    (side) => side.map(({ color }) => color),
  )
}
