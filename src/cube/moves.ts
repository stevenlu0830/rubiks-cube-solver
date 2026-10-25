import {
  dot,
  faceNormal,
  quarterTurnClockwise,
  STICKERS,
  stickerIndexAt,
  type Vec3,
} from './geometry.ts'
import { FACES, type Face } from './state.ts'

/**
 * Standard cube notation:
 * - U D L R F B turn that outer face a quarter turn clockwise, as seen
 *   looking straight at that face.
 * - x y z turn the whole cube the same way as R, U and F respectively. They
 *   change which side faces the user but don't scramble anything.
 * - A ' suffix means anticlockwise; a 2 suffix means a half turn.
 */
export type Axis = 'x' | 'y' | 'z'
type BaseMove = Face | Axis
export type Move = `${BaseMove}${'' | "'" | '2'}`

const BASE_MOVES: readonly BaseMove[] = [...FACES, 'x', 'y', 'z']
const AXIS_FACE: Record<Axis, Face> = { x: 'R', y: 'U', z: 'F' }

export const MOVES: readonly Move[] = BASE_MOVES.flatMap(
  (base) => [base, `${base}'`, `${base}2`] as const,
)

/**
 * A permutation p describes a move as "new cell j takes the colour of old
 * cell p[j]". Applying a move is then a single array lookup per cell.
 */
type Permutation = readonly number[]

function quarterTurn(base: BaseMove): Permutation {
  const wholeCube = base === 'x' || base === 'y' || base === 'z'
  const axis: Vec3 = faceNormal(wholeCube ? AXIS_FACE[base] : base)
  const source = STICKERS.map((_, i) => i)
  STICKERS.forEach(({ position, normal }, i) => {
    // A face turn only moves the layer of cubies touching that face.
    if (!wholeCube && dot(position, axis) !== 1) return
    const j = stickerIndexAt(
      quarterTurnClockwise(position, axis),
      quarterTurnClockwise(normal, axis),
    )
    source[j] = i
  })
  return source
}

/** The permutation for doing `first`, then `second`. */
function then(first: Permutation, second: Permutation): Permutation {
  return second.map((k) => first[k])
}

const PERMUTATIONS = new Map<Move, Permutation>(
  BASE_MOVES.flatMap((base) => {
    const quarter = quarterTurn(base)
    const half = then(quarter, quarter)
    return [
      [base, quarter],
      [`${base}2`, half],
      [`${base}'`, then(half, quarter)],
    ] as const
  }),
)

export function isMove(token: string): token is Move {
  return PERMUTATIONS.has(token as Move)
}

/**
 * Works on any array of 54 cells, not only colours. Tests use this with
 * numbered cells to check every cell lands exactly where it should.
 */
export function applyMove<T>(state: readonly T[], move: Move): T[] {
  return PERMUTATIONS.get(move)!.map((i) => state[i])
}

export function applyMoves<T>(
  state: readonly T[],
  moves: readonly Move[],
): T[] {
  return moves.reduce<T[]>(
    (current, move) => applyMove(current, move),
    [...state],
  )
}

export function invertMove(move: Move): Move {
  if (move.endsWith('2')) return move
  if (move.endsWith("'")) return move.slice(0, -1) as Move
  return `${move}'` as Move
}

/** The moves that undo `moves`: reversed order, each move inverted. */
export function invertMoves(moves: readonly Move[]): Move[] {
  return [...moves].reverse().map(invertMove)
}

/** Parses space-separated notation such as "R U R' U2". */
export function parseMoves(text: string): Move[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (!isMove(token)) throw new Error(`Unknown move "${token}"`)
      return token
    })
}

export function formatMoves(moves: readonly Move[]): string {
  return moves.join(' ')
}

/**
 * Random face turns, never turning the same face twice in a row (that would
 * just be one longer turn). Pass your own `random` to get repeatable results.
 */
export function randomScramble(
  length = 25,
  random: () => number = Math.random,
): Move[] {
  const suffixes = ['', "'", '2'] as const
  const moves: Move[] = []
  let lastFace: Face | undefined
  while (moves.length < length) {
    const face = FACES[Math.floor(random() * FACES.length)]
    if (face === lastFace) continue
    moves.push(`${face}${suffixes[Math.floor(random() * suffixes.length)]}`)
    lastFace = face
  }
  return moves
}
