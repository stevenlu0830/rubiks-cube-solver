import {
  centreCellsOf,
  edgeCellsOf,
  wingCellsOf,
} from '../../src/cube/cubies.ts'
import {
  applyMoves,
  movesOf,
  parseMoves,
  type Move,
} from '../../src/cube/moves.ts'
import { PUZZLE_5X5 } from '../../src/cube/puzzle.ts'
import {
  cellIndex,
  FACES,
  solvedState,
  STANDARD_SCHEME,
  type CubeState,
} from '../../src/cube/state.ts'

export const SOLVED_5X5 = solvedState(STANDARD_SCHEME, PUZZLE_5X5)

/** A 5x5 scrambled by turns of every kind: face, wide and inner-layer, as in the browser tests. */
export const SCRAMBLED_5X5 = applyMoves(
  SOLVED_5X5,
  parseMoves("R U2 F' Rw u2 L D Fw' r B2 Dw b2 R' U f L2 d' Bw l2 F"),
)

/** Every turn a 5x5 can make but the whole-cube ones: face, wide and inner-layer turns. */
export const FIVE_BY_FIVE_TURNS = movesOf(PUZZLE_5X5).filter(
  (move) => !/^[xyz]/.test(move),
)

/** `length` random turns of every kind. */
export function randomTurns(length: number, random: () => number): Move[] {
  return Array.from(
    { length },
    () => FIVE_BY_FIVE_TURNS[Math.floor(random() * FIVE_BY_FIVE_TURNS.length)],
  )
}

/** True when the nine centre squares of every face are one colour. */
export function centresSolved(cube: CubeState): boolean {
  const centres = centreCellsOf(PUZZLE_5X5)
  return FACES.every((_, face) => {
    const colors = centres
      .filter((cell) => Math.floor(cell / 25) === face)
      .map((cell) => cube[cell])
    return colors.length === 9 && colors.every((color) => color === colors[0])
  })
}

/**
 * True when every edge's three pieces match: each outer piece's colour on
 * each face is its middle piece's.
 */
export function edgesJoined(cube: CubeState): boolean {
  const middles = edgeCellsOf(PUZZLE_5X5)
  return wingCellsOf(PUZZLE_5X5).every((outer, slot) =>
    outer.every((cell) => {
      const beside = middles[slot >> 1].find(
        (middle) => Math.floor(middle / 25) === Math.floor(cell / 25),
      )!
      return cube[cell] === cube[beside]
    }),
  )
}

/**
 * The cube read as a 3x3: each face's corners, middle edge pieces and fixed
 * centre. Once the centres are solved and the edges joined, it's the 3x3
 * the 5x5 has become.
 */
export function asThreeByThree(cube: CubeState): CubeState {
  const keep = [0, 2, 4]
  return FACES.flatMap((face) =>
    keep.flatMap((row) =>
      keep.map((column) => cube[cellIndex(face, row * 5 + column, PUZZLE_5X5)]),
    ),
  )
}
