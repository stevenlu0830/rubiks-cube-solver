import { Vector3 } from 'three'
import { faceNormal, layerFrom, type Vec3 } from '../cube/geometry.ts'
import { turnedLayers, type Move } from '../cube/moves.ts'
import { PUZZLE_3X3, type Puzzle } from '../cube/puzzle.ts'

/**
 * How to animate a turn: which pieces move, and how they rotate. The
 * rotation must end exactly where the move engine (cube/moves.ts) puts every
 * sticker, so swapping in the new cube state when the animation ends is
 * seamless; the tests check this for every turn each cube can make.
 */

/**
 * True for the pieces (cubie centres) in the layers that `move` turns: 9 on
 * a 3x3, 4 on a 2x2. On a 4x4, a face turn turns 16 pieces, an inner layer
 * 16 (only 12 of them show), and a wide turn both; on a 5x5, 25 and 25
 * (only 16 show).
 */
export function isInTurningLayer(
  position: Vec3,
  move: Move,
  puzzle: Puzzle = PUZZLE_3X3,
): boolean {
  const { face, layers } = turnedLayers(move, puzzle)
  return layers.includes(layerFrom(face, position, puzzle))
}

/**
 * The axis (the outward direction of the face the move is named after) and
 * angle (radians) of a turn. Clockwise, seen from that face, is a negative
 * angle in three.js.
 */
export function turnRotation(move: Move): { axis: Vector3; angle: number } {
  const quarters = move.endsWith('2') ? -2 : move.endsWith("'") ? 1 : -1
  return {
    axis: new Vector3(...faceNormal(turnedLayers(move).face)),
    angle: (quarters * Math.PI) / 2,
  }
}
