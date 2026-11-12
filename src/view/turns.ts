import { Vector3 } from 'three'
import { dot, faceNormal, outerLayer, type Vec3 } from '../cube/geometry.ts'
import type { Move } from '../cube/moves.ts'
import { PUZZLE_3X3, type Puzzle } from '../cube/puzzle.ts'
import { turnedFace } from '../solve/moveGuide.ts'

/**
 * How to animate a face turn: which pieces move, and how they rotate. The
 * rotation must end exactly where the move engine (cube/moves.ts) puts every
 * sticker, so swapping in the new cube state when the animation ends is
 * seamless; the tests check this for all 18 face turns, on both cubes.
 */

/** True for the pieces (cubie centres) in the layer that `move` turns: 9 on a 3x3, 4 on a 2x2. */
export function isInTurningLayer(
  position: Vec3,
  move: Move,
  puzzle: Puzzle = PUZZLE_3X3,
): boolean {
  return dot(position, faceNormal(turnedFace(move))) === outerLayer(puzzle)
}

/**
 * The axis (the turning face's outward direction) and angle (radians) of a
 * face turn. Clockwise, seen from that face, is a negative angle in three.js.
 */
export function turnRotation(move: Move): { axis: Vector3; angle: number } {
  const quarters = move.endsWith('2') ? -2 : move.endsWith("'") ? 1 : -1
  return {
    axis: new Vector3(...faceNormal(turnedFace(move))),
    angle: (quarters * Math.PI) / 2,
  }
}
