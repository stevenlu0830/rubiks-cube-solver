import { Matrix4, Quaternion, Vector3 } from 'three'
import { STICKERS } from '../cube/geometry.ts'
import type { Move } from '../cube/moves.ts'
import { TURN_GUIDES, turnedFace } from '../solve/moveGuide.ts'
import { CUBIE_SIZE } from './layout.ts'

/** How far arrows float above the stickers, so they're always on top. */
const ARROW_LIFT = 0.03

/**
 * Where to draw the arrow for a face turn: along the row or column of
 * visible stickers that move (see TURN_GUIDES), pointing the way they go.
 * The arrow shape is drawn along +x, lying flat facing +z; `quaternion`
 * turns it onto the cube.
 */
export function arrowPlacement(move: Move): {
  position: Vector3
  quaternion: Quaternion
  /** Half turns get a two-headed arrow: either way round works. */
  doubleHeaded: boolean
} {
  const guide = TURN_GUIDES[turnedFace(move)]
  const [first, , last] = move.endsWith("'")
    ? [...guide.cells].reverse()
    : guide.cells
  const from = new Vector3(...STICKERS[first].position)
  const to = new Vector3(...STICKERS[last].position)
  const normal = new Vector3(...STICKERS[first].normal)
  const along = to.clone().sub(from).normalize()
  const across = normal.clone().cross(along)
  return {
    position: from
      .add(to)
      .multiplyScalar(0.5)
      .addScaledVector(normal, CUBIE_SIZE / 2 + ARROW_LIFT),
    quaternion: new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(along, across, normal),
    ),
    doubleHeaded: move.endsWith('2'),
  }
}
