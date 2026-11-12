import type { Move } from '../cube/moves.ts'
import { perPuzzle, PUZZLE_3X3 } from '../cube/puzzle.ts'
import { cellIndex, type Face } from '../cube/state.ts'

/**
 * How to explain each face turn to someone holding a real cube. Turns of the
 * back, left and bottom faces are hard to see from the front, so every turn
 * is described by a row or column of stickers that stays in view (on the
 * front or top face) and which way it moves. The same guide places the
 * arrow drawn on the 3D cube.
 */

type Direction = 'left' | 'right' | 'up' | 'down'

export interface TurnGuide {
  /** The visible face the guide row/column is on. */
  face: 'F' | 'U'
  /**
   * A whole row or column of cells that move during a clockwise turn (3 on
   * a 3x3, 2 on a 2x2), listed in the direction they move.
   */
  cells: readonly number[]
  /** Which way they move during a clockwise turn, as seen from the front. */
  direction: Direction
}

/** Each face turn's guide, for each size of cube. */
export const turnGuidesOf = perPuzzle((puzzle): Record<Face, TurnGuide> => {
  const last = puzzle.size - 1
  /** The cell at this row and column (from the top left) of a face. */
  const at = (face: Face) => (row: number, column: number) =>
    cellIndex(face, row * puzzle.size + column, puzzle)
  const front = at('F')
  const top = at('U')
  /** 0, 1, … along a row or column. */
  const along = (cell: (i: number) => number) =>
    Array.from({ length: puzzle.size }, (_, i) => cell(i))
  return {
    // e.g. on a 3x3, U is F2 F1 F0: the front's top row, moving left.
    U: {
      face: 'F',
      cells: along((i) => front(0, last - i)),
      direction: 'left',
    },
    D: { face: 'F', cells: along((i) => front(last, i)), direction: 'right' },
    R: {
      face: 'F',
      cells: along((i) => front(last - i, last)),
      direction: 'up',
    },
    L: { face: 'F', cells: along((i) => front(i, 0)), direction: 'down' },
    F: { face: 'U', cells: along((i) => top(last, i)), direction: 'right' },
    B: { face: 'U', cells: along((i) => top(0, last - i)), direction: 'left' },
  }
})

/** A 3x3's guides. Which face and direction each uses is the same for a 2x2. */
export const TURN_GUIDES: Record<Face, TurnGuide> = turnGuidesOf(PUZZLE_3X3)

const FACE_NAMES: Record<Face, string> = {
  U: 'top',
  D: 'bottom',
  R: 'right',
  L: 'left',
  F: 'front',
  B: 'back',
}

const OPPOSITE: Record<Direction, Direction> = {
  left: 'right',
  right: 'left',
  up: 'down',
  down: 'up',
}

/** The face a move turns, e.g. 'R' for "R'". */
export function turnedFace(move: Move): Face {
  const face = move[0]
  if (!(face in FACE_NAMES)) throw new Error(`${move} is not a face turn`)
  return face as Face
}

/** Plain English for a face turn, e.g. "Turn the right face clockwise (front stickers move up)". */
export function describeMove(move: Move): string {
  const face = turnedFace(move)
  const name = FACE_NAMES[face]
  if (move.endsWith('2')) return `Turn the ${name} face twice (a half turn)`
  const guide = TURN_GUIDES[face]
  const anticlockwise = move.endsWith("'")
  const direction = anticlockwise ? OPPOSITE[guide.direction] : guide.direction
  const stickers = guide.face === 'F' ? 'front' : 'top'
  return `Turn the ${name} face ${anticlockwise ? 'anticlockwise' : 'clockwise'} (${stickers} stickers move ${direction})`
}
