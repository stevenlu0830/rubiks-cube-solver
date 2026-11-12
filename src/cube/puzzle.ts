/**
 * The cubes the app knows, and the numbers that follow from each one's
 * size. Code that works for any cube takes a Puzzle (or works it out from
 * how many cells a cube has, see puzzleOf) instead of assuming 3×3.
 *
 * A 2x2 is a 3x3 without its middle layers: the same six faces in the same
 * order (see state.ts), but 4 cells per face instead of 9, and no centres.
 * Each face is still read left-to-right, top-to-bottom from outside, so a
 * 2x2's cells fold out into this net:
 *
 *           U0 U1
 *           U2 U3
 *    L0 L1  F0 F1  R0 R1  B0 B1
 *    L2 L3  F2 F3  R2 R3  B2 B3
 *           D0 D1
 *           D2 D3
 *
 * Cell U0 is index 0, R0 is 4, F0 is 8, D0 is 12, L0 is 16, B0 is 20.
 */

export const CUBE_TYPES = ['2x2', '3x3'] as const
export type CubeType = (typeof CUBE_TYPES)[number]

export interface Puzzle {
  name: CubeType
  /** Squares along each edge of a face: 2 or 3. */
  size: 2 | 3
  /** Squares on each face: 4 or 9. */
  cellsPerFace: number
  /** Squares on the whole cube: 24 or 54. */
  cellCount: number
  /** How many squares of each colour a real cube has: one face's worth, 4 or 9. */
  cellsPerColor: number
  /**
   * Whether each face has a centre square. Centres never move, so on a 3x3
   * they say which colour each face is; a 2x2 has none.
   */
  hasCenters: boolean
}

function puzzle(name: CubeType, size: 2 | 3): Puzzle {
  const cellsPerFace = size * size
  return {
    name,
    size,
    cellsPerFace,
    cellCount: 6 * cellsPerFace,
    cellsPerColor: cellsPerFace,
    hasCenters: size % 2 === 1,
  }
}

export const PUZZLE_2X2 = puzzle('2x2', 2)
export const PUZZLE_3X3 = puzzle('3x3', 3)

export const PUZZLES: Readonly<Record<CubeType, Puzzle>> = {
  '2x2': PUZZLE_2X2,
  '3x3': PUZZLE_3X3,
}

/**
 * Which cube a list of cells is for, told by how many there are: 24 for a
 * 2x2, 54 for a 3x3. Works on colours, cell numbers, anything.
 */
export function puzzleOf(cells: { readonly length: number }): Puzzle {
  const found = Object.values(PUZZLES).find(
    ({ cellCount }) => cellCount === cells.length,
  )
  if (!found) throw new Error(`No cube has ${cells.length} cells`)
  return found
}

/**
 * Wraps `make` so it runs once per puzzle and its answer is kept: for
 * tables worked out from a puzzle's size, such as where every sticker is.
 */
export function perPuzzle<T>(
  make: (puzzle: Puzzle) => T,
): (puzzle: Puzzle) => T {
  const made = new Map<Puzzle, T>()
  return (puzzle) => {
    if (!made.has(puzzle)) made.set(puzzle, make(puzzle))
    return made.get(puzzle)!
  }
}
