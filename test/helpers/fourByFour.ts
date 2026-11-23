import { WING_CELLS } from '../../src/cube/cubies.ts'
import {
  applyMoves,
  movesOf,
  parseMoves,
  type Move,
} from '../../src/cube/moves.ts'
import { PUZZLE_4X4 } from '../../src/cube/puzzle.ts'
import {
  cellIndex,
  FACES,
  solvedState,
  STANDARD_SCHEME,
  type CubeState,
} from '../../src/cube/state.ts'

/** A 4x4 scrambled by turns of every kind, as in the end-to-end tests. */
export const SCRAMBLED_4X4 = applyMoves(
  solvedState(STANDARD_SCHEME, PUZZLE_4X4),
  parseMoves("R U2 F' Rw u2 L D Fw' r B2 Dw b2 R' U f L2"),
)

/** Every turn a 4x4 can make but the whole-cube ones: face, wide and inner-layer turns. */
export const FOUR_BY_FOUR_TURNS = movesOf(PUZZLE_4X4).filter(
  (move) => !/^[xyz]/.test(move),
)

/** `length` random turns of every kind. */
export function randomTurns(length: number, random: () => number): Move[] {
  return Array.from(
    { length },
    () => FOUR_BY_FOUR_TURNS[Math.floor(random() * FOUR_BY_FOUR_TURNS.length)],
  )
}

/** True when the four centre squares of every face are one colour. */
export function centresSolved(cube: CubeState): boolean {
  return FACES.every((face) => {
    const colors = [5, 6, 9, 10].map(
      (n) => cube[cellIndex(face, n, PUZZLE_4X4)],
    )
    return colors.every((color) => color === colors[0])
  })
}

/** True when every edge's two pieces sit side by side (see WING_CELLS). */
export function edgesPaired(cube: CubeState): boolean {
  const colorsOf = (piece: number) =>
    WING_CELLS[piece]
      .map((cell) => cube[cell])
      .toSorted()
      .join()
  return Array.from({ length: 12 }, (_, edge) => edge).every(
    (edge) => colorsOf(2 * edge) === colorsOf(2 * edge + 1),
  )
}

/**
 * The cube read as a 3x3: each face's corners, one cell of each edge and
 * one centre. Once the centres are solved and the edges paired, it's the
 * 3x3 the 4x4 has become.
 */
export function asThreeByThree(cube: CubeState): CubeState {
  const keep = [0, 1, 3]
  return FACES.flatMap((face) =>
    keep.flatMap((row) =>
      keep.map((column) => cube[cellIndex(face, row * 4 + column, PUZZLE_4X4)]),
    ),
  )
}
