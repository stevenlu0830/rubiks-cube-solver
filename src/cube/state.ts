/**
 * The cube as 54 coloured cells: the app's single source of truth.
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

/** All 54 cells, indexed as described at the top of this file. */
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

/** Position of the centre cell within a face (0–8). */
export const CENTER = 4

export function cellIndex(face: Face, n: number): number {
  return FACES.indexOf(face) * 9 + n
}

/** A cube with no cells painted: what the user starts from. */
export function emptyState(): CubeState {
  return Array<Cell>(54).fill(null)
}

export function solvedState(scheme: ColorScheme = STANDARD_SCHEME): CubeState {
  return FACES.flatMap((face) => Array<Cell>(9).fill(scheme[face]))
}

/** True when every face is painted in a single colour. */
export function isSolved(state: CubeState): boolean {
  return FACES.every((face) => {
    const center = state[cellIndex(face, CENTER)]
    return (
      center !== null &&
      state
        .slice(cellIndex(face, 0), cellIndex(face, 9))
        .every((c) => c === center)
    )
  })
}
