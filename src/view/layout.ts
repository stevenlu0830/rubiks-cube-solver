import { Matrix4, Quaternion, Vector3 } from 'three'
import { STICKERS } from '../cube/geometry.ts'

/**
 * Where every part of the 3D cube goes, kept apart from the React components
 * so it can be unit-tested without a browser.
 *
 * Units and axes match cube/geometry.ts (which also happen to be three.js's
 * defaults): neighbouring cubie centres are 1 apart, so the cube spans -1.5
 * to 1.5 on each axis, with x right, y up and z towards the viewer.
 */

type Tuple3 = [number, number, number]

/** Edge length of a cubie. Just under 1, leaving a hairline gap between cubies. */
export const CUBIE_SIZE = 0.98
/** Edge length of a sticker, leaving a black plastic border around it. */
export const STICKER_SIZE = 0.84
export const STICKER_CORNER_RADIUS = 0.1
/** Stickers float this far off the plastic, so the two never flicker through each other. */
const STICKER_LIFT = 0.002

export interface StickerLayout {
  /** Index into CubeState: the cell this sticker shows, and what a tap on it refers to. */
  cell: number
  /** Position relative to the centre of its cubie. */
  offset: Tuple3
  /**
   * Turns a flat sticker lying in the x-y plane (facing +z, top towards +y)
   * so it faces outwards, with its top pointing "up" as drawn in the net.
   */
  quaternion: Quaternion
}

export interface CubieLayout {
  position: Tuple3
  stickers: StickerLayout[]
}

function stickerLayout(cell: number): StickerLayout {
  const { normal, up } = STICKERS[cell]
  const n = new Vector3(...normal)
  const u = new Vector3(...up)
  const right = new Vector3().crossVectors(u, n)
  return {
    cell,
    offset: n
      .clone()
      .multiplyScalar(CUBIE_SIZE / 2 + STICKER_LIFT)
      .toArray(),
    quaternion: new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(right, u, n),
    ),
  }
}

/** The 26 visible cubies (the hidden centre one is skipped), each with its stickers. */
export const CUBIES: readonly CubieLayout[] = (() => {
  const byPosition = new Map<string, CubieLayout>()
  STICKERS.forEach(({ position }, cell) => {
    const key = position.join()
    if (!byPosition.has(key))
      byPosition.set(key, { position: [...position], stickers: [] })
    byPosition.get(key)!.stickers.push(stickerLayout(cell))
  })
  return [...byPosition.values()]
})()
