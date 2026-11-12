import { PUZZLE_3X3, puzzleOf, type Puzzle } from './puzzle.ts'

/**
 * The cube as coloured cells: the app's single source of truth. A 3x3 has
 * 54 cells, as below; a 2x2 has 24, in the same order (see puzzle.ts).
 *
 * Faces come in the order U R F D L B (Up, Right, Front, Down, Left, Back),
 * 9 cells each, which is the order the Kociemba solver expects. Each face is
 * read left-to-right, top-to-bottom while looking straight at it from
 * outside, so the cells fold out into this net:
 *
 *              U0 U1 U2
 *              U3 U4 U5
 *              U6 U7 U8
 *    L0 L1 L2  F0 F1 F2  R0 R1 R2  B0 B1 B2
 *    L3 L4 L5  F3 F4 F5  R3 R4 R5  B3 B4 B5
 *    L6 L7 L8  F6 F7 F8  R6 R7 R8  B6 B7 B8
 *              D0 D1 D2
 *              D3 D4 D5
 *              D6 D7 D8
 *
 * Cell U0 is index 0, R0 is index 9, F0 is 18, D0 is 27, L0 is 36, B0 is 45.
 */

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const
export type Face = (typeof FACES)[number]

export const COLORS = [
  'white',
  'yellow',
  'green',
  'blue',
  'red',
  'orange',
] as const
export type Color = (typeof COLORS)[number]

/** A cell's colour, or null while the user hasn't painted it yet. */
export type Cell = Color | null

/** All the cells (54 on a 3x3, 24 on a 2x2), indexed as described at the top of this file. */
export type CubeState = readonly Cell[]

/** Which colour each face's centre has. */
export type ColorScheme = Readonly<Record<Face, Color>>

export const STANDARD_SCHEME: ColorScheme = {
  U: 'white',
  R: 'red',
  F: 'green',
  D: 'yellow',
  L: 'orange',
  B: 'blue',
}

/**
 * The colour on the opposite side of the cube, with the standard colours.
 * A 3x3's centres show which colours are opposite; a 2x2 has no centres,
 * so this is assumed (nearly every cube is coloured this way).
 */
export const OPPOSITE_COLOR: Readonly<Record<Color, Color>> = {
  white: 'yellow',
  yellow: 'white',
  red: 'orange',
  orange: 'red',
  green: 'blue',
  blue: 'green',
}

/** How many cells of each colour a real 3x3 has (see Puzzle for any cube). */
export const CELLS_PER_COLOR = PUZZLE_3X3.cellsPerColor

/** Position of the centre cell within a 3x3's face (0–8). A 2x2 has none. */
export const CENTER = 4

/** The index of cell `n` (counted along each row, see above) of a face. */
export function cellIndex(
  face: Face,
  n: number,
  puzzle: Puzzle = PUZZLE_3X3,
): number {
  return FACES.indexOf(face) * puzzle.cellsPerFace + n
}

/** A cube with no cells painted: what the user starts from. */
export function emptyState(puzzle: Puzzle = PUZZLE_3X3): CubeState {
  return Array<Cell>(puzzle.cellCount).fill(null)
}

export function solvedState(
  scheme: ColorScheme = STANDARD_SCHEME,
  puzzle: Puzzle = PUZZLE_3X3,
): CubeState {
  return FACES.flatMap((face) =>
    Array<Cell>(puzzle.cellsPerFace).fill(scheme[face]),
  )
}

/** True when every face is painted in a single colour. */
export function isSolved(state: CubeState): boolean {
  const puzzle = puzzleOf(state)
  return FACES.every((face) => {
    const first = state[cellIndex(face, 0, puzzle)]
    return (
      first !== null &&
      state
        .slice(
          cellIndex(face, 0, puzzle),
          cellIndex(face, puzzle.cellsPerFace, puzzle),
        )
        .every((c) => c === first)
    )
  })
}

/** How many cells are painted in each colour. */
export function colorCounts(cube: CubeState): Record<Color, number> {
  const counts = Object.fromEntries(
    COLORS.map((color) => [color, 0]),
  ) as Record<Color, number>
  for (const cell of cube) {
    if (cell !== null) counts[cell]++
  }
  return counts
}
