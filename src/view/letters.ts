import { Quaternion, Vector3 } from 'three'
import { STICKERS } from '../cube/geometry.ts'
import { SCREEN_UP } from './camera.ts'

/**
 * Keeps the colour letters on the stickers (see COLOR_LETTERS) the right way
 * up. A letter drawn the way the cell sits in the net can end up sideways or
 * upside down once the user has swiped the cube round, and an upside-down
 * W looks like an M. So each sticker is spun (0–3 quarter turns) to whichever
 * way puts its letter closest to upright on screen.
 */

/**
 * For each cell: how many quarter turns anticlockwise to spin its sticker
 * (see CubieLayout's `spun`) so its letter reads upright, with the cube
 * shown in `orientation`.
 */
export function letterSpins(orientation: Quaternion): number[] {
  return STICKERS.map(({ normal, up }) => {
    const n = new Vector3(...normal)
    const u = new Vector3(...up)
    const right = new Vector3().crossVectors(u, n)
    // Where the letter's top points after 0, 1, 2 or 3 quarter turns.
    const tops = [u, right.clone().negate(), u.clone().negate(), right]
    const upness = tops.map((top) =>
      top.clone().applyQuaternion(orientation).dot(SCREEN_UP),
    )
    return upness.indexOf(Math.max(...upness))
  })
}
