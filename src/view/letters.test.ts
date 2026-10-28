import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { faceNormal, STICKERS } from '../cube/geometry.ts'
import { CAMERA_DIRECTION, SCREEN_UP } from './camera.ts'
import { CUBIES } from './layout.ts'
import { letterSpins } from './letters.ts'
import { frontFace, turnBySwipe } from './orientation.ts'

/** All 24 ways round the cube can be shown, reached by swiping. */
const ORIENTATIONS = (() => {
  const found = [new Quaternion()]
  for (let i = 0; i < found.length; i++) {
    for (const direction of ['left', 'up'] as const) {
      const next = turnBySwipe(found[i], direction)
      if (!found.some((q) => Math.abs(q.dot(next)) > 0.999)) found.push(next)
    }
  }
  return found
})()

const SCREEN_RIGHT = new Vector3().crossVectors(SCREEN_UP, CAMERA_DIRECTION)
const STICKER_LAYOUTS = CUBIES.flatMap((cubie) => cubie.stickers)

/** Where the top of each cell's letter points in 3D, with the cube in `orientation`. */
function letterTops(orientation: Quaternion) {
  const spins = letterSpins(orientation)
  return STICKER_LAYOUTS.map(({ cell, spun }) => ({
    cell,
    top: new Vector3(0, 1, 0)
      .applyQuaternion(spun[spins[cell]])
      .applyQuaternion(orientation),
    facing: new Vector3(...STICKERS[cell].normal).applyQuaternion(orientation),
  }))
}

describe('letterSpins', () => {
  it('finds all 24 orientations to test', () => {
    expect(ORIENTATIONS).toHaveLength(24)
  })

  it.each(ORIENTATIONS.map((q, i) => [i, q] as const))(
    'orientation %i: letters on the face towards you stand exactly upright',
    (_, orientation) => {
      const front = new Vector3(
        ...faceNormal(frontFace(orientation)),
      ).applyQuaternion(orientation)
      const facingYou = letterTops(orientation).filter(
        ({ facing }) => facing.dot(front) > 0.99,
      )
      expect(facingYou).toHaveLength(9)
      for (const { top } of facingYou) {
        expect(top.dot(SCREEN_RIGHT)).toBeCloseTo(0)
        expect(top.dot(SCREEN_UP)).toBeGreaterThan(0.9)
      }
    },
  )

  it.each(ORIENTATIONS.map((q, i) => [i, q] as const))(
    'orientation %i: every letter you can see points up the screen, not down',
    (_, orientation) => {
      const visible = letterTops(orientation).filter(
        ({ facing }) => facing.dot(CAMERA_DIRECTION) > 0.1,
      )
      expect(visible).toHaveLength(27) // the front, top and right faces
      for (const { top } of visible) {
        expect(top.dot(SCREEN_UP)).toBeGreaterThan(0.3)
      }
    },
  )
})
