import { CENTER, cellIndex, FACES, type CubeState } from '../cube/state.ts'

/**
 * The cube in the solver's format: for each cell (in the usual U R F D L B
 * order), the letter of the face whose centre has that cell's colour. A
 * solved cube is "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB".
 * The cube must be fully painted with six different centres.
 */
export function toFaceletString(cube: CubeState): string {
  const faceOfColor = new Map(
    FACES.map((face) => [cube[cellIndex(face, CENTER)], face]),
  )
  return cube.map((cell) => faceOfColor.get(cell)).join('')
}
