import { MathUtils, Vector3 } from 'three'
import type { Puzzle } from '../cube/puzzle.ts'

/**
 * The camera looks at the cube's centre from slightly above and to the
 * right, so the front face is big enough to tap while the top and right
 * faces show the cube is 3D. Its position is given as two angles:
 * - azimuth: degrees round to the right of straight-on. Raising it looks the
 *   same as turning the cube clockwise (seen from above): more right face.
 * - elevation: degrees above the cube's middle. Raising it shows more top.
 */
const CAMERA_AZIMUTH = 25
const CAMERA_ELEVATION = 21.5

export const CAMERA_DIRECTION = new Vector3().setFromSphericalCoords(
  1,
  MathUtils.degToRad(90 - CAMERA_ELEVATION),
  MathUtils.degToRad(CAMERA_AZIMUTH),
)
export const CAMERA_FOV = 30

/** The 3D direction that points straight up the screen. */
export const SCREEN_UP = (() => {
  const right = new Vector3(0, 1, 0).cross(CAMERA_DIRECTION).normalize()
  return CAMERA_DIRECTION.clone().cross(right)
})()

/** The share of the view left empty round the cube, on every side. */
export const CAMERA_MARGIN = 0.08

/**
 * Half the cube's outer size: a 3x3 spans -1.5 to 1.5 on each axis, a 2x2
 * -1 to 1. The camera moves in closer for a 2x2, so it looks the same size
 * on screen, with bigger stickers.
 */
export function cubeHalfSize(puzzle: Puzzle): number {
  return puzzle.size / 2
}

/**
 * How far from the centre the camera must be for the whole cube to fit on
 * screen with `margin` (a fraction of the view) to spare on every side.
 * Checks all 8 outer corners of the cube, so it works for any screen shape:
 * narrow portrait phones are limited by width, wide screens by height.
 * `halfSize` is the cube's (see cubeHalfSize); the default is a 3x3's.
 */
export function fitCameraDistance(
  direction: Vector3,
  verticalFovDegrees: number,
  aspect: number,
  margin = CAMERA_MARGIN,
  halfSize = 1.5,
): number {
  const back = direction.clone().normalize()
  const right = new Vector3(0, 1, 0).cross(back).normalize()
  const up = back.clone().cross(right)
  const tanVertical =
    Math.tan(MathUtils.degToRad(verticalFovDegrees) / 2) * (1 - margin)
  const tanHorizontal = tanVertical * aspect

  let distance = 0
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        const corner = new Vector3(x, y, z).multiplyScalar(halfSize)
        // The camera sits at back × distance, so a corner is this much closer to it
        // than the centre is. It must be far enough away to fit both sideways and vertically.
        const towardCamera = corner.dot(back)
        distance = Math.max(
          distance,
          towardCamera + Math.abs(corner.dot(right)) / tanHorizontal,
          towardCamera + Math.abs(corner.dot(up)) / tanVertical,
        )
      }
    }
  }
  return distance
}
