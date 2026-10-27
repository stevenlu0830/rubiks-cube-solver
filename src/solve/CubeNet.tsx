import { cellIndex, FACES, type CubeState, type Face } from '../cube/state.ts'
import { STICKER_COLORS } from '../view/colors.ts'

/** Where each face sits in the unfolded cube (row, column), as drawn in cube/state.ts. */
const NET_POSITION: Record<Face, [number, number]> = {
  U: [1, 2],
  L: [2, 1],
  F: [2, 2],
  R: [2, 3],
  B: [2, 4],
  D: [3, 2],
}

interface CubeNetProps {
  state: CubeState
  /** The face about to turn, outlined. */
  activeFace: Face | null
}

/**
 * A small flat map of all six faces, so the back, left and bottom (hidden in
 * the 3D view) can be seen too.
 */
export function CubeNet({ state, activeFace }: CubeNetProps) {
  return (
    <div className="cube-net" role="img" aria-label="Map of all six faces">
      {FACES.map((face) => {
        const [row, column] = NET_POSITION[face]
        return (
          <div
            key={face}
            className="cube-net-face"
            data-active={face === activeFace || undefined}
            style={{ gridRow: row, gridColumn: column }}
          >
            {Array.from({ length: 9 }, (_, n) => {
              const color = state[cellIndex(face, n)]
              return (
                <span
                  key={n}
                  style={{
                    background: color ? STICKER_COLORS[color] : 'transparent',
                  }}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
