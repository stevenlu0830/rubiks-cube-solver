import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { CAMERA_DIRECTION, CAMERA_FOV, fitCameraDistance } from './camera.ts'

const MARGIN = 0.08

/** Where the cube's 8 corners land on screen, from -1 (left/bottom edge) to 1 (right/top edge). */
function cornersOnScreen(aspect: number): Vector3[] {
  const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 100)
  const distance = fitCameraDistance(
    CAMERA_DIRECTION,
    CAMERA_FOV,
    aspect,
    MARGIN,
  )
  camera.position.copy(CAMERA_DIRECTION).multiplyScalar(distance)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  const corners: Vector3[] = []
  for (const x of [-1.5, 1.5]) {
    for (const y of [-1.5, 1.5]) {
      for (const z of [-1.5, 1.5]) {
        corners.push(new Vector3(x, y, z).project(camera))
      }
    }
  }
  return corners
}

describe('fitCameraDistance', () => {
  // Tall phone, square, and wide desktop screens.
  it.each([0.45, 0.6, 1, 1.8])(
    'fits the whole cube on a %s-wide screen, as large as the margin allows',
    (aspect) => {
      const corners = cornersOnScreen(aspect)
      const furthest = Math.max(
        ...corners.flatMap((c) => [Math.abs(c.x), Math.abs(c.y)]),
      )
      expect(furthest).toBeCloseTo(1 - MARGIN)
    },
  )

  it('moves the camera further back on a narrow portrait screen', () => {
    const portrait = fitCameraDistance(CAMERA_DIRECTION, CAMERA_FOV, 0.5)
    const square = fitCameraDistance(CAMERA_DIRECTION, CAMERA_FOV, 1)
    expect(portrait).toBeGreaterThan(square)
  })

  it('shows the front face facing the camera, with a little of the top and right', () => {
    expect(CAMERA_DIRECTION.z).toBeGreaterThan(CAMERA_DIRECTION.x)
    expect(CAMERA_DIRECTION.z).toBeGreaterThan(CAMERA_DIRECTION.y)
    expect(CAMERA_DIRECTION.x).toBeGreaterThan(0)
    expect(CAMERA_DIRECTION.y).toBeGreaterThan(0)
  })
})
