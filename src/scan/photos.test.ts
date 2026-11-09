import { describe, expect, it } from 'vitest'
import { checkRecordedScans, type RecordedScan } from './scanDebug.ts'

/**
 * Real photos of a real cube, recorded with ?scan-debug: how to add them is
 * in test-photos/README.md. Each file holds the scans downloaded from one
 * phone session.
 */
const files = import.meta.glob<RecordedScan[]>('./test-photos/*.json', {
  eager: true,
  import: 'default',
})
const scans = Object.values(files).flat()

/** At least this share of squares must be named right, with no help by hand. */
const ACCURACY = 0.95

describe.skipIf(scans.length === 0)('real photos', () => {
  it(`names at least ${ACCURACY * 100}% of squares right`, () => {
    const { squares, misreads } = checkRecordedScans(scans)
    const wrong = misreads.map(
      ({ light, face, square, expected, got }) =>
        `${light}, ${face}${square}: ${expected} read as ${got}`,
    )
    expect(
      1 - misreads.length / squares,
      `${misreads.length} of ${squares} wrong:\n${wrong.join('\n')}`,
    ).toBeGreaterThanOrEqual(ACCURACY)
  })
})
