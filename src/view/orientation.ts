import { Matrix4, Quaternion, Vector3 } from 'three'
import { faceNormal, STICKERS, stickerIndexAt } from '../cube/geometry.ts'
import { FACES, type Face } from '../cube/state.ts'
import type { SwipeDirection } from './gestures.ts'

/**
 * Which way round the 3D cube is shown. This only turns the picture: the
 * cells and their colours never change, which is why painting still works
 * after any number of turns.
 *
 * Orientations are stored as quaternions, three.js's way of describing a
 * rotation. A cube turned only in quarter turns can sit in exactly 24 ways
 * (6 faces that can point at you × 4 ways to spin it), so after every turn
 * the result is snapped to the nearest of those 24. Otherwise tiny rounding
 * errors from each turn would pile up and the cube would slowly go crooked.
 */

const UP_AXIS = new Vector3(0, 1, 0)
const RIGHT_AXIS = new Vector3(1, 0, 0)
const quarter = (axis: Vector3, clockwise: boolean) =>
  new Quaternion().setFromAxisAngle(
    axis,
    clockwise ? -Math.PI / 2 : Math.PI / 2,
  )

/**
 * Each swipe turns the whole cube a quarter turn about the screen's
 * vertical or horizontal axis, matching cube notation:
 * - left = y: clockwise seen from above, so the right face comes to the front
 * - right = y': the left face comes to the front
 * - up = x: like an R turn, so the bottom face comes to the front
 * - down = x': the top face comes to the front
 */
const SWIPE_TURNS: Record<SwipeDirection, Quaternion> = {
  left: quarter(UP_AXIS, true),
  right: quarter(UP_AXIS, false),
  up: quarter(RIGHT_AXIS, true),
  down: quarter(RIGHT_AXIS, false),
}

/** The orientation after a swipe, snapped exactly to one of the 24. */
export function turnBySwipe(
  current: Quaternion,
  direction: SwipeDirection,
): Quaternion {
  // Multiplying on the left turns about the screen's axes, not the cube's own.
  return snapToCubeOrientation(SWIPE_TURNS[direction].clone().multiply(current))
}

/**
 * Rounds an almost-exact quarter-turn rotation to the exact one. For such
 * rotations every entry of the rotation matrix is -1, 0 or 1.
 */
export function snapToCubeOrientation(rotation: Quaternion): Quaternion {
  const matrix = new Matrix4().makeRotationFromQuaternion(rotation)
  matrix.fromArray(matrix.elements.map((value) => Math.round(value)))
  return new Quaternion().setFromRotationMatrix(matrix)
}

/** Which of the cube's faces points towards `direction` when shown in this orientation. */
export function faceTowards(orientation: Quaternion, direction: Vector3): Face {
  return FACES.find((face) => {
    const normal = new Vector3(...faceNormal(face)).applyQuaternion(orientation)
    return normal.dot(direction) > 0.9
  })!
}

/** The face nearest the viewer: the one facing out of the screen. */
export function frontFace(orientation: Quaternion): Face {
  return faceTowards(orientation, new Vector3(0, 0, 1))
}

/** The face on top. */
export function topFace(orientation: Quaternion): Face {
  return faceTowards(orientation, UP_AXIS)
}

/**
 * The cells as the user sees them on screen: cell U4 is whatever centre is
 * on top right now, F4 whatever centre faces them, and so on. The solver is
 * given the cube this way, so its moves (R, U, …) mean the sides the user
 * actually sees, and the user can hold their real cube the same way.
 */
export function cubeAsShown<T>(
  cube: readonly T[],
  orientation: Quaternion,
): T[] {
  const turnBack = orientation.clone().invert()
  return STICKERS.map(({ position, normal }) => {
    // Turn this spot on the screen back to where it is on the unturned cube.
    const from = new Vector3(...position).applyQuaternion(turnBack).round()
    const facing = new Vector3(...normal).applyQuaternion(turnBack).round()
    return cube[stickerIndexAt(from.toArray(), facing.toArray())]
  })
}
