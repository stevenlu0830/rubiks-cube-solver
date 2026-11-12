import { cornerCellsOf, CORNERS, faceColorsOf } from '../cube/cubies.ts'
import { puzzleOf } from '../cube/puzzle.ts'
import {
  FACES,
  OPPOSITE_COLOR,
  type ColorScheme,
  type CubeState,
} from '../cube/state.ts'

/**
 * The cube in the solver's format: for each cell (in the usual U R F D L B
 * order), the letter of the face that cell's colour belongs on. A solved
 * 3x3 is "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"; a solved
 * 2x2 is "UUUURRRRFFFFDDDDLLLLBBBB". The cube must be fully painted and pass
 * validateCube.
 *
 * On a 3x3 the centres say which face each colour belongs on. A 2x2 has no
 * centres, so it's worked out from the back-bottom-left corner, which the
 * 2x2 solver never moves (see colorsKeepingCorner).
 */
export function toFaceletString(cube: CubeState): string {
  const scheme = puzzleOf(cube).hasCenters
    ? faceColorsOf(cube)!
    : colorsKeepingCorner(cube)
  const faceOfColor = new Map(FACES.map((face) => [scheme[face], face]))
  return cube.map((cell) => faceOfColor.get(cell!)).join('')
}

/**
 * Which colour each face of a 2x2 ends up when it's solved by turning only
 * the top, right and front faces: then the back-bottom-left corner never
 * moves, so its three stickers give the bottom, back and left colours, and
 * the faces opposite them get the opposite colours (see OPPOSITE_COLOR).
 */
export function colorsKeepingCorner(cube: CubeState): ColorScheme {
  const puzzle = puzzleOf(cube)
  const [down, back, left] = cornerCellsOf(puzzle)[CORNERS.indexOf('DBL')].map(
    (cell) => cube[cell]!,
  )
  return {
    U: OPPOSITE_COLOR[down],
    R: OPPOSITE_COLOR[left],
    F: OPPOSITE_COLOR[back],
    D: down,
    L: left,
    B: back,
  }
}
