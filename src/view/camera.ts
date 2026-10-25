import { MathUtils, Vector3 } from 'three'

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

/** Half the cube's outer size: the cube spans -1.5 to 1.5 on each axis. */
const CUBE_HALF_SIZE = 1.5

/**
 * How far from the centre the camera must be for the whole cube to fit on
 * screen with `margin` (a fraction of the view) to spare on every side.
 * Checks all 8 outer corners of the cube, so it works for any screen shape:
 * narrow portrait phones are limited by width, wide screens by height.
 */
export function fitCameraDistance(
  direction: Vector3,
  verticalFovDegrees: number,
  aspect: number,
  margin = 0.08,
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
        const corner = new Vector3(x, y, z).multiplyScalar(CUBE_HALF_SIZE)
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
