import type { Color } from '../cube/state.ts'
import { STICKER_COLORS } from '../view/colors.ts'

/**
 * A small drawing of a solved cube, seen from above at the front right:
 * white on top, green in front, red on the right, with `size` stickers
 * along each edge. Only decoration, so screen readers skip it.
 */

type Vec3 = readonly [number, number, number]

/**
 * Flattens a point of a cube spanning 0 to 1 on each axis onto the page,
 * seen equally from x, y and z (isometric): x goes down to the right, z
 * down to the left, y straight up. The cube's nearest corner (1, 1, 1)
 * lands at the drawing's centre.
 */
function project([x, y, z]: Vec3): string {
  const across = ((x - z) * Math.sqrt(3)) / 2
  const down = (x + z) / 2 - y
  return `${round(across)},${round(down)}`
}

const round = (n: number) => Math.round(n * 1000) / 1000

/** The three faces in view: a corner, and the two directions along the face from it. */
const FACES: readonly {
  origin: Vec3
  across: Vec3
  down: Vec3
  color: Color
}[] = [
  { origin: [0, 1, 0], across: [1, 0, 0], down: [0, 0, 1], color: 'white' },
  { origin: [0, 1, 1], across: [1, 0, 0], down: [0, -1, 0], color: 'green' },
  { origin: [1, 1, 1], across: [0, 0, -1], down: [0, -1, 0], color: 'red' },
]

/** Gap round each sticker, as a share of the sticker's square. */
const GAP = 0.1

/** The outline of the whole cube: six corners of a hexagon. */
const OUTLINE = (
  [
    [0, 1, 0],
    [1, 1, 0],
    [1, 0, 0],
    [1, 0, 1],
    [0, 0, 1],
    [0, 1, 1],
  ] as const
)
  .map(project)
  .join(' ')

function stickers(size: number) {
  return FACES.flatMap(({ origin, across, down, color }) =>
    Array.from({ length: size * size }, (_, n) => {
      const column = n % size
      const row = Math.floor(n / size)
      /** A point on this sticker's square: `a` across it and `d` down it, each 0 to 1. */
      const point = (a: number, d: number): Vec3 => {
        const s = (column + a) / size
        const t = (row + d) / size
        const at = (k: number) => origin[k] + s * across[k] + t * down[k]
        return [at(0), at(1), at(2)]
      }
      const corners = [
        point(GAP, GAP),
        point(1 - GAP, GAP),
        point(1 - GAP, 1 - GAP),
        point(GAP, 1 - GAP),
      ]
      return { color, points: corners.map(project).join(' ') }
    }),
  )
}

export function CubeIcon({ size }: { size: number }) {
  return (
    <svg
      className="cube-icon"
      viewBox="-0.95 -1.05 1.9 2.1"
      aria-hidden="true"
      focusable="false"
    >
      <polygon
        points={OUTLINE}
        fill="#1c1c22"
        stroke="#1c1c22"
        strokeWidth="0.06"
        strokeLinejoin="round"
      />
      {stickers(size).map(({ color, points }) => (
        <polygon
          key={points}
          points={points}
          fill={STICKER_COLORS[color]}
          stroke={STICKER_COLORS[color]}
          strokeWidth="0.015"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}
