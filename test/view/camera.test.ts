import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { stickersOf } from '../../src/cube/geometry.ts'
import {
  PUZZLE_2X2,
  PUZZLE_3X3,
  PUZZLE_4X4,
  PUZZLE_5X5,
  type Puzzle,
} from '../../src/cube/puzzle.ts'
import { cellIndex, type Face } from '../../src/cube/state.ts'
import {
  CAMERA_DIRECTION,
  CAMERA_FOV,
  CAMERA_MARGIN,
  cubeHalfSize,
  fitCameraDistance,
} from '../../src/view/camera.ts'
import { CUBIE_SIZE, STICKER_SIZE } from '../../src/view/layout.ts'

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

describe('on a 2x2', () => {
  it('is 2 cubies across, so half its size is 1 (a 3x3: 1.5)', () => {
    expect(cubeHalfSize(PUZZLE_2X2)).toBe(1)
    expect(cubeHalfSize(PUZZLE_3X3)).toBe(1.5)
  })

  it.each([0.45, 1, 1.8])(
    'fits the whole cube on a %s-wide screen, as large as the margin allows',
    (aspect) => {
      const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 100)
      const distance = fitCameraDistance(
        CAMERA_DIRECTION,
        CAMERA_FOV,
        aspect,
        CAMERA_MARGIN,
        cubeHalfSize(PUZZLE_2X2),
      )
      camera.position.copy(CAMERA_DIRECTION).multiplyScalar(distance)
      camera.lookAt(0, 0, 0)
      camera.updateMatrixWorld()
      let furthest = 0
      for (const x of [-1, 1]) {
        for (const y of [-1, 1]) {
          for (const z of [-1, 1]) {
            const corner = new Vector3(x, y, z).project(camera)
            furthest = Math.max(
              furthest,
              Math.abs(corner.x),
              Math.abs(corner.y),
            )
          }
        }
      }
      expect(furthest).toBeCloseTo(1 - CAMERA_MARGIN)
    },
  )

  it('moves the camera in closer than for a 3x3, so the cube looks as big', () => {
    const fit = (halfSize: number) =>
      fitCameraDistance(
        CAMERA_DIRECTION,
        CAMERA_FOV,
        0.6,
        CAMERA_MARGIN,
        halfSize,
      )
    expect(fit(cubeHalfSize(PUZZLE_2X2))).toBeLessThan(
      fit(cubeHalfSize(PUZZLE_3X3)),
    )
    expect(fit(cubeHalfSize(PUZZLE_3X3))).toBe(
      fitCameraDistance(CAMERA_DIRECTION, CAMERA_FOV, 0.6),
    )
  })
})

/**
 * How wide each of a face's stickers looks on a screen this size, in CSS
 * pixels, as the cube first shows: across its narrowest way, since the top
 * and right faces are seen at a slant.
 */
function stickerWidths(
  puzzle: Puzzle,
  face: Face,
  width: number,
  height: number,
): number[] {
  const camera = new PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 100)
  camera.position
    .copy(CAMERA_DIRECTION)
    .multiplyScalar(
      fitCameraDistance(
        CAMERA_DIRECTION,
        CAMERA_FOV,
        width / height,
        CAMERA_MARGIN,
        cubeHalfSize(puzzle),
      ),
    )
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  const onScreen = (point: Vector3) => {
    const { x, y } = point.project(camera)
    return { x: ((x + 1) / 2) * width, y: ((1 - y) / 2) * height }
  }
  return Array.from({ length: puzzle.cellsPerFace }, (_, n) => {
    const { position, normal, up } =
      stickersOf(puzzle)[cellIndex(face, n, puzzle)]
    const out = new Vector3(...normal)
    const centre = new Vector3(...position).addScaledVector(out, CUBIE_SIZE / 2)
    const upward = new Vector3(...up).multiplyScalar(STICKER_SIZE / 2)
    const right = upward.clone().cross(out)
    const span = (half: Vector3) => {
      const [a, b] = [
        onScreen(centre.clone().sub(half)),
        onScreen(centre.clone().add(half)),
      ]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    return Math.min(span(right), span(upward))
  })
}

describe('on a 4x4', () => {
  it('is 4 cubies across, so half its size is 2', () => {
    expect(cubeHalfSize(PUZZLE_4X4)).toBe(2)
  })

  it.each([0.45, 1, 1.8])(
    'fits the whole cube on a %s-wide screen, as large as the margin allows',
    (aspect) => {
      const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 100)
      const distance = fitCameraDistance(
        CAMERA_DIRECTION,
        CAMERA_FOV,
        aspect,
        CAMERA_MARGIN,
        cubeHalfSize(PUZZLE_4X4),
      )
      camera.position.copy(CAMERA_DIRECTION).multiplyScalar(distance)
      camera.lookAt(0, 0, 0)
      camera.updateMatrixWorld()
      let furthest = 0
      for (const x of [-2, 2]) {
        for (const y of [-2, 2]) {
          for (const z of [-2, 2]) {
            const corner = new Vector3(x, y, z).project(camera)
            furthest = Math.max(
              furthest,
              Math.abs(corner.x),
              Math.abs(corner.y),
            )
          }
        }
      }
      expect(furthest).toBeCloseTo(1 - CAMERA_MARGIN)
    },
  )

  it('moves the camera further back than for a 3x3, so the cube looks as big', () => {
    const fit = (puzzle: Puzzle) =>
      fitCameraDistance(
        CAMERA_DIRECTION,
        CAMERA_FOV,
        0.6,
        CAMERA_MARGIN,
        cubeHalfSize(puzzle),
      )
    expect(fit(PUZZLE_4X4)).toBeGreaterThan(fit(PUZZLE_3X3))
  })

  // A 375 × 812 phone has 375 × 527 pixels for the cube, between the
  // palette and the buttons. 44 pixels is a comfortable size to tap.
  it('makes every front sticker at least 44px across on a 375px-wide phone', () => {
    const front = stickerWidths(PUZZLE_4X4, 'F', 375, 527)
    expect(Math.min(...front)).toBeGreaterThanOrEqual(44)
  })
})

describe('on a 5x5', () => {
  it('is 5 cubies across, so half its size is 2.5', () => {
    expect(cubeHalfSize(PUZZLE_5X5)).toBe(2.5)
  })

  it.each([0.45, 1, 1.8])(
    'fits the whole cube on a %s-wide screen, as large as the margin allows',
    (aspect) => {
      const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 100)
      const distance = fitCameraDistance(
        CAMERA_DIRECTION,
        CAMERA_FOV,
        aspect,
        CAMERA_MARGIN,
        cubeHalfSize(PUZZLE_5X5),
      )
      camera.position.copy(CAMERA_DIRECTION).multiplyScalar(distance)
      camera.lookAt(0, 0, 0)
      camera.updateMatrixWorld()
      let furthest = 0
      for (const x of [-2.5, 2.5]) {
        for (const y of [-2.5, 2.5]) {
          for (const z of [-2.5, 2.5]) {
            const corner = new Vector3(x, y, z).project(camera)
            furthest = Math.max(
              furthest,
              Math.abs(corner.x),
              Math.abs(corner.y),
            )
          }
        }
      }
      expect(furthest).toBeCloseTo(1 - CAMERA_MARGIN)
    },
  )

  it('moves the camera further back than for a 4x4, so the cube looks as big', () => {
    const fit = (puzzle: Puzzle) =>
      fitCameraDistance(
        CAMERA_DIRECTION,
        CAMERA_FOV,
        0.6,
        CAMERA_MARGIN,
        cubeHalfSize(puzzle),
      )
    expect(fit(PUZZLE_5X5)).toBeGreaterThan(fit(PUZZLE_4X4))
  })

  // With 5 to a row, the stickers can't all be the 44 pixels a 4x4's are on
  // the same phone: the smallest come to about 35, still well over the 24
  // that WCAG 2.2 asks of anything to tap (its "target size" rule).
  it('makes every front sticker at least 35px across on a 375px-wide phone', () => {
    const front = stickerWidths(PUZZLE_5X5, 'F', 375, 527)
    expect(Math.min(...front)).toBeGreaterThanOrEqual(35)
  })
})
