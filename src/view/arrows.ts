import { Matrix4, Quaternion, Vector3 } from 'three'
import { stickersOf } from '../cube/geometry.ts'
import type { Move } from '../cube/moves.ts'
import { PUZZLE_3X3, type Puzzle } from '../cube/puzzle.ts'
import { layerGuideOf } from '../solve/moveGuide.ts'
import { CUBIE_SIZE } from './layout.ts'

/** How far arrows float above the stickers, so they're always on top. */
const ARROW_LIFT = 0.03

export interface ArrowPlacement {
  position: Vector3
  quaternion: Quaternion
  /** Half turns get a two-headed arrow: either way round works. */
  doubleHeaded: boolean
}

/**
 * Where to draw the arrows for a turn: one along each row or column of
 * visible stickers that moves (see layerGuideOf), pointing the way they go.
 * A face turn or an inner-layer turn has one; a 4x4's or 5x5's wide turn
 * has two side by side, one for each layer. The arrow shape is drawn along
 * +x, lying flat facing +z; `quaternion` turns it onto the cube.
 */
export function arrowPlacements(
  move: Move,
  puzzle: Puzzle = PUZZLE_3X3,
): ArrowPlacement[] {
  const stickers = stickersOf(puzzle)
  return layerGuideOf(move, puzzle).lines.map((line) => {
    const cells = move.endsWith("'") ? [...line].reverse() : line
    const first = stickers[cells[0]]
    const last = stickers[cells[cells.length - 1]]
    const from = new Vector3(...first.position)
    const to = new Vector3(...last.position)
    const normal = new Vector3(...first.normal)
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
  })
}
