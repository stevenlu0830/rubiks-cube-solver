import { turnedLayers, type Move } from '../cube/moves.ts'
import { perPuzzle, PUZZLE_3X3, type Puzzle } from '../cube/puzzle.ts'
import { cellIndex, FACES, type Face } from '../cube/state.ts'

/**
 * How to explain each turn to someone holding a real cube. Turns of the
 * back, left and bottom faces are hard to see from the front, so every turn
 * is described by a row or column of stickers that stays in view (on the
 * front or top face) and which way it moves. The same guide places the
 * arrows drawn on the 3D cube.
 *
 * A 4x4's or 5x5's wide turns (Rw) move two rows or columns at once, and
 * its inner-layer turns (r) the second one in from the face, so their
 * guides have a line of stickers for each layer that turns.
 */

type Direction = 'left' | 'right' | 'up' | 'down'

export interface TurnGuide {
  /** The visible face the guide row/column is on. */
  face: 'F' | 'U'
  /**
   * A whole row or column of cells that move during a clockwise face turn
   * (3 on a 3x3, 2 on a 2x2, 4 on a 4x4, 5 on a 5x5), listed in the
   * direction they move.
   */
  cells: readonly number[]
  /** Which way they move during a clockwise turn, as seen from the front. */
  direction: Direction
}

/** A turn's guide: one line of cells for each layer it turns, from the outside in. */
export interface LayerGuide {
  face: 'F' | 'U'
  lines: readonly (readonly number[])[]
  direction: Direction
}

/**
 * Each face's guide line, `depth` layers in from that face (0 is the face
 * itself), for each size of cube.
 */
const guideLinesOf = perPuzzle(
  (
    puzzle,
  ): Record<
    Face,
    Pick<TurnGuide, 'face' | 'direction'> & {
      line: (depth: number) => number[]
    }
  > => {
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
        direction: 'left',
        line: (d) => along((i) => front(d, last - i)),
      },
      D: {
        face: 'F',
        direction: 'right',
        line: (d) => along((i) => front(last - d, i)),
      },
      R: {
        face: 'F',
        direction: 'up',
        line: (d) => along((i) => front(last - i, last - d)),
      },
      L: {
        face: 'F',
        direction: 'down',
        line: (d) => along((i) => front(i, d)),
      },
      F: {
        face: 'U',
        direction: 'right',
        line: (d) => along((i) => top(last - d, i)),
      },
      B: {
        face: 'U',
        direction: 'left',
        line: (d) => along((i) => top(d, last - i)),
      },
    }
  },
)

/** Each face turn's guide, for each size of cube. */
export const turnGuidesOf = perPuzzle((puzzle): Record<Face, TurnGuide> => {
  const guides: Partial<Record<Face, TurnGuide>> = {}
  for (const face of FACES) {
    const { face: on, direction, line } = guideLinesOf(puzzle)[face]
    guides[face] = { face: on, direction, cells: line(0) }
  }
  return guides as Record<Face, TurnGuide>
})

/** A 3x3's guides. Which face and direction each uses is the same for any cube. */
export const TURN_GUIDES: Record<Face, TurnGuide> = turnGuidesOf(PUZZLE_3X3)

/** The guide for any turn but a whole-cube one: a line of cells for each layer it turns. */
export function layerGuideOf(
  move: Move,
  puzzle: Puzzle = PUZZLE_3X3,
): LayerGuide {
  if (/^[xyz]/.test(move)) throw new Error(`${move} turns the whole cube`)
  const { face, layers } = turnedLayers(move, puzzle)
  const { face: on, direction, line } = guideLinesOf(puzzle)[face]
  return { face: on, direction, lines: layers.map(line) }
}

/** Each face's name in words, as seen holding the cube. */
export const FACE_NAMES: Record<Face, string> = {
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

/**
 * The face a turn turns, e.g. 'R' for "R'", or for "Rw2", which turns it
 * along with the layer behind. Null for an inner layer on its own (r),
 * which turns no face.
 */
export function turnedFace(move: Move): Face | null {
  if (/^[xyz]/.test(move)) throw new Error(`${move} is not a face turn`)
  const { face, layers } = turnedLayers(move)
  return layers.includes(0) ? face : null
}

/** What turns, in words: "the right face", "the right two layers", "only the second layer from the right". */
function whatTurns(move: Move): string {
  const { face, layers } = turnedLayers(move)
  const name = FACE_NAMES[face]
  if (layers.length === 2) return `the ${name} two layers`
  return layers[0] === 0
    ? `the ${name} face`
    : `only the second layer from the ${name}`
}

/**
 * Plain English for a turn, e.g. "Turn the right face clockwise (front
 * stickers move up)", or on a 4x4 or 5x5 "Turn the right two layers
 * clockwise…" and "Turn only the second layer from the right clockwise…".
 */
export function describeMove(move: Move): string {
  if (/^[xyz]/.test(move)) throw new Error(`${move} is not a face turn`)
  const turns = whatTurns(move)
  if (move.endsWith('2')) return `Turn ${turns} twice (a half turn)`
  const guide = TURN_GUIDES[turnedLayers(move).face]
  const anticlockwise = move.endsWith("'")
  const direction = anticlockwise ? OPPOSITE[guide.direction] : guide.direction
  const stickers = guide.face === 'F' ? 'front' : 'top'
  return `Turn ${turns} ${anticlockwise ? 'anticlockwise' : 'clockwise'} (${stickers} stickers move ${direction})`
}
