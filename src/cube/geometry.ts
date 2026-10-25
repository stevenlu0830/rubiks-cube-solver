import { FACES, type Face } from './state.ts'

/**
 * Where each of the 54 cells sits in 3D space. The move engine uses this to
 * work out turns by actually rotating points, instead of hand-typed lookup
 * tables, and the 3D view uses it to place stickers.
 *
 * Axes: x points right (towards R), y points up (towards U), z points at the
 * viewer (towards F). The cube is 3×3×3 small cubes ("cubies") whose centres
 * have coordinates -1, 0 or 1.
 */

export type Vec3 = readonly [number, number, number]

export interface Sticker {
  /** Centre of the cubie the sticker is on. */
  position: Vec3
  /** Direction the sticker faces: its face's outward normal. */
  normal: Vec3
  /** Direction of "up" on the sticker's face, as drawn in the net. */
  up: Vec3
}

/**
 * For each face: its outward normal, and which 3D directions are "one cell
 * right" and "one cell down" when looking at that face as drawn in the net
 * in state.ts.
 */
const FACE_AXES: Record<Face, { normal: Vec3; right: Vec3; down: Vec3 }> = {
  U: { normal: [0, 1, 0], right: [1, 0, 0], down: [0, 0, 1] },
  R: { normal: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0] },
  F: { normal: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] },
  D: { normal: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1] },
  L: { normal: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0] },
  B: { normal: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0] },
}

export function faceNormal(face: Face): Vec3 {
  return FACE_AXES[face].normal
}

/** STICKERS[i] is where cell i sits; same indexing as CubeState. */
export const STICKERS: readonly Sticker[] = FACES.flatMap((face) => {
  const { normal, right, down } = FACE_AXES[face]
  return Array.from({ length: 9 }, (_, n) => {
    const col = (n % 3) - 1
    const row = Math.floor(n / 3) - 1
    const position: Vec3 = [
      normal[0] + col * right[0] + row * down[0],
      normal[1] + col * right[1] + row * down[1],
      normal[2] + col * right[2] + row * down[2],
    ]
    const up: Vec3 = [-down[0], -down[1], -down[2]]
    return { position, normal, up }
  })
})

const stickerKey = (position: Vec3, normal: Vec3) => `${position}|${normal}`

const INDEX_BY_STICKER = new Map(
  STICKERS.map(({ position, normal }, i) => [stickerKey(position, normal), i]),
)

/** The cell index of the sticker at this position facing this way. */
export function stickerIndexAt(position: Vec3, normal: Vec3): number {
  const index = INDEX_BY_STICKER.get(stickerKey(position, normal))
  if (index === undefined) {
    throw new Error(`No sticker at ${position} facing ${normal}`)
  }
  return index
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/**
 * Rotates v a quarter turn clockwise around `axis`, as seen looking at the
 * cube from the side `axis` points to. `axis` must be a unit axis vector.
 */
export function quarterTurnClockwise(v: Vec3, axis: Vec3): Vec3 {
  // Rodrigues' rotation formula for -90°: v' = axis(axis·v) - axis × v
  const d = dot(axis, v)
  return [
    axis[0] * d - (axis[1] * v[2] - axis[2] * v[1]),
    axis[1] * d - (axis[2] * v[0] - axis[0] * v[2]),
    axis[2] * d - (axis[0] * v[1] - axis[1] * v[0]),
  ]
}
