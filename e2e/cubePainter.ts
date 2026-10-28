import { expect, type Page } from '@playwright/test'
import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { STICKERS } from '../src/cube/geometry.ts'
import { COLORS, type CubeState } from '../src/cube/state.ts'
import {
  CAMERA_DIRECTION,
  CAMERA_FOV,
  fitCameraDistance,
} from '../src/view/camera.ts'
import type { SwipeDirection } from '../src/view/gestures.ts'
import { CUBIE_SIZE } from '../src/view/layout.ts'
import { turnBySwipe } from '../src/view/orientation.ts'

/** How long a swipe's turn of the whole cube takes, with time to spare. */
const SWIPE_SETTLE_MS = 400
/** Stickers seen more edge-on than this are skipped: they're hard to hit. */
const MIN_FACING = 0.3
/** Turns that, between them, bring all six faces into view. */
const TOUR: (SwipeDirection | null)[] = [null, 'left', 'left', 'up']

/**
 * Paints the 3D cube the way a person would: picks a colour, taps stickers,
 * swipes to see the other sides. It keeps track of how the cube is turned,
 * using the app's own camera and swipe code, to work out where on screen
 * each sticker is.
 */
export class CubePainter {
  /** How the cube is turned on screen right now. */
  orientation = new Quaternion()
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async paint(cube: CubeState) {
    await this.waitUntilSized()
    const left = new Set(STICKERS.keys())
    for (const swipe of TOUR) {
      if (swipe) await this.swipe(swipe)
      const onScreen = await this.stickersOnScreen()
      for (const color of COLORS) {
        const cells = [...left].filter(
          (cell) => cube[cell] === color && onScreen.has(cell),
        )
        if (cells.length === 0) continue
        await this.page
          .getByRole('button', { name: new RegExp(`^${color},`) })
          .click()
        for (const cell of cells) {
          const { x, y } = onScreen.get(cell)!
          await this.page.touchscreen.tap(x, y)
          left.delete(cell)
        }
      }
    }
    if (left.size > 0) throw new Error(`Never saw cells ${[...left]}`)
  }

  /** Drags a finger (well, a mouse) across the middle of the cube. */
  async swipe(direction: SwipeDirection) {
    const box = await this.canvasBox()
    const [dx, dy] = {
      left: [-1, 0],
      right: [1, 0],
      up: [0, -1],
      down: [0, 1],
    }[direction].map((unit) => unit * 50)
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await this.page.mouse.move(x - dx, y - dy)
    await this.page.mouse.down()
    await this.page.mouse.move(x + dx, y + dy, { steps: 5 })
    await this.page.mouse.up()
    this.orientation = turnBySwipe(this.orientation, direction)
    await this.page.waitForTimeout(SWIPE_SETTLE_MS)
  }

  /** Where each sticker facing the camera shows on the page, in CSS pixels. */
  private async stickersOnScreen() {
    const box = await this.canvasBox()
    // The same camera as the app's CameraFit.
    const aspect = box.width / box.height
    const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 100)
    camera.position
      .copy(CAMERA_DIRECTION)
      .multiplyScalar(fitCameraDistance(CAMERA_DIRECTION, CAMERA_FOV, aspect))
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()

    const found = new Map<number, { x: number; y: number }>()
    STICKERS.forEach(({ position, normal }, cell) => {
      const facing = new Vector3(...normal).applyQuaternion(this.orientation)
      if (facing.dot(CAMERA_DIRECTION) < MIN_FACING) return
      const centre = new Vector3(...position)
        .addScaledVector(new Vector3(...normal), CUBIE_SIZE / 2)
        .applyQuaternion(this.orientation)
        .project(camera)
      found.set(cell, {
        x: box.x + ((centre.x + 1) / 2) * box.width,
        y: box.y + ((1 - centre.y) / 2) * box.height,
      })
    })
    return found
  }

  /**
   * The 3D view starts at a placeholder size and is resized to fill its
   * space a moment later; positions worked out before then would be wrong.
   */
  private async waitUntilSized() {
    const stage = this.page.getByRole('main')
    await expect
      .poll(async () => {
        const [canvas, space] = [
          await this.canvasBox(),
          await stage.boundingBox(),
        ]
        return canvas.width === space?.width && canvas.height === space.height
      })
      .toBe(true)
    // Let the camera move back to fit and the cube be drawn at that size.
    await this.page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    )
  }

  private async canvasBox() {
    const box = await this.page.locator('canvas').boundingBox()
    if (!box) throw new Error('The 3D view is not on screen')
    return box
  }
}
