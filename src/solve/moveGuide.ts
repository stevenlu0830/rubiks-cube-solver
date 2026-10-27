import type { Move } from '../cube/moves.ts'
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
  /** Three cells in a row or column that move during a clockwise turn, listed in the direction they move. */
  cells: [number, number, number]
  /** Which way they move during a clockwise turn, as seen from the front. */
  direction: Direction
}

const front = (n: number) => cellIndex('F', n)
const top = (n: number) => cellIndex('U', n)

export const TURN_GUIDES: Record<Face, TurnGuide> = {
  U: { face: 'F', cells: [front(2), front(1), front(0)], direction: 'left' },
  D: { face: 'F', cells: [front(6), front(7), front(8)], direction: 'right' },
  R: { face: 'F', cells: [front(8), front(5), front(2)], direction: 'up' },
  L: { face: 'F', cells: [front(0), front(3), front(6)], direction: 'down' },
  F: { face: 'U', cells: [top(6), top(7), top(8)], direction: 'right' },
  B: { face: 'U', cells: [top(2), top(1), top(0)], direction: 'left' },
}

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
