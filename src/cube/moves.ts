import {
  faceNormal,
  layerFrom,
  quarterTurnClockwise,
  stickerIndexAt,
  stickersOf,
} from './geometry.ts'
import { perPuzzle, PUZZLE_3X3, puzzleOf, type Puzzle } from './puzzle.ts'
import { FACES, type Face } from './state.ts'

/**
 * Standard cube notation:
 * - U D L R F B turn that outer face a quarter turn clockwise, as seen
 *   looking straight at that face.
 * - x y z turn the whole cube the same way as R, U and F respectively. They
 *   change which side faces the user but don't scramble anything.
 * - A ' suffix means anticlockwise; a 2 suffix means a half turn.
 *
 * A 4x4 or 5x5 has inner layers between each pair of opposite faces, so it
 * also has:
 * - Uw Dw Lw Rw Fw Bw ("wide") turn that face together with the inner
 *   layer behind it: the outer two layers at once.
 * - u d l r f b turn only the inner layer behind that face, the same way as
 *   the face: r is the layer next to R, turning like R.
 *
 * A 5x5 has the same moves, with Rw and r meaning the same two layers. Its
 * middle layer, between r and l, has no move of its own: only x, y and z
 * turn it, along with the rest of the cube. So a 5x5's centre squares (see
 * centerOf in state.ts) never move, as on a 3x3.
 */
export type Axis = 'x' | 'y' | 'z'
type Wide = `${Face}w`
type Inner = Lowercase<Face>
type BaseMove = Face | Wide | Inner | Axis
export type Move = `${BaseMove}${'' | "'" | '2'}`

const AXES: readonly Axis[] = ['x', 'y', 'z']
const AXIS_FACE: Record<Axis, Face> = { x: 'R', y: 'U', z: 'F' }

/** Every cube's: its 6 faces, and the whole cube 3 ways. */
const EVERY_CUBE: readonly BaseMove[] = [...FACES, ...AXES]
/** Only a cube with inner layers to itself has these (a 4x4 or 5x5). */
const LAYERS: readonly BaseMove[] = [
  ...FACES.map((face): Wide => `${face}w`),
  ...FACES.map((face) => face.toLowerCase() as Inner),
]

/** The moves this cube's turns are made from: R, Rw, r, x… */
function basesOf(puzzle: Puzzle): readonly BaseMove[] {
  return puzzle.size >= 4 ? [...EVERY_CUBE, ...LAYERS] : EVERY_CUBE
}

/** Each move a quarter turn clockwise, anticlockwise ('), and a half turn (2). */
const withTurns = (bases: readonly BaseMove[]): Move[] =>
  bases.flatMap((base) => [base, `${base}'`, `${base}2`] as const)

/** The moves every cube has: 18 face turns and 9 whole-cube turns. */
export const MOVES: readonly Move[] = withTurns(EVERY_CUBE)

/** The moves only a 4x4 or 5x5 has: 18 wide turns and 18 inner-layer turns. */
export const LAYER_MOVES: readonly Move[] = withTurns(LAYERS)

/** Every move this cube can make: MOVES, plus LAYER_MOVES on a 4x4 or 5x5. */
export function movesOf(puzzle: Puzzle): readonly Move[] {
  return withTurns(basesOf(puzzle))
}

/** A move without its ' or 2: R, Rw, r or x. */
function baseOf(move: Move): BaseMove {
  return move.replace(/['2]$/, '') as BaseMove
}

/** The layers a move turns (see turnedLayers). */
export interface LayerTurn {
  /** The face the move is named after: it turns clockwise as seen looking at this face. */
  face: Face
  /**
   * Which layers turn, counted in from that face (see layerFrom): 0 is the
   * face itself, 1 the inner layer behind it.
   */
  layers: readonly number[]
}

/**
 * Which face a move is named after and which of its layers turn: [0] for a
 * face turn (R), [0, 1] for a wide turn (Rw), [1] for an inner layer (r).
 * A whole-cube turn turns every layer: x turns all of them like R.
 */
export function turnedLayers(
  move: Move,
  puzzle: Puzzle = PUZZLE_3X3,
): LayerTurn {
  const base = baseOf(move)
  if (base in AXIS_FACE) {
    return {
      face: AXIS_FACE[base as Axis],
      layers: Array.from({ length: puzzle.size }, (_, layer) => layer),
    }
  }
  const face = base[0].toUpperCase() as Face
  const layers = base.endsWith('w') ? [0, 1] : base === face ? [0] : [1]
  return { face, layers }
}

/**
 * A permutation p describes a move as "new cell j takes the colour of old
 * cell p[j]". Applying a move is then a single array lookup per cell.
 */
type Permutation = readonly number[]

function quarterTurn(base: BaseMove, puzzle: Puzzle): Permutation {
  const { face, layers } = turnedLayers(base, puzzle)
  const axis = faceNormal(face)
  const stickers = stickersOf(puzzle)
  const source = stickers.map((_, i) => i)
  stickers.forEach(({ position, normal }, i) => {
    // Only the cubies in the turning layers move.
    if (!layers.includes(layerFrom(face, position, puzzle))) return
    const j = stickerIndexAt(
      quarterTurnClockwise(position, axis),
      quarterTurnClockwise(normal, axis),
      puzzle,
    )
    source[j] = i
  })
  return source
}

/** The permutation for doing `first`, then `second`. */
function then(first: Permutation, second: Permutation): Permutation {
  return second.map((k) => first[k])
}

/** Every move's permutation, worked out once for each cube size. */
const permutationsOf = perPuzzle(
  (puzzle) =>
    new Map<Move, Permutation>(
      basesOf(puzzle).flatMap((base) => {
        const quarter = quarterTurn(base, puzzle)
        const half = then(quarter, quarter)
        return [
          [base, quarter],
          [`${base}2`, half],
          [`${base}'`, then(half, quarter)],
        ] as const
      }),
    ),
)

const MOVE_NAMES: ReadonlySet<string> = new Set([...MOVES, ...LAYER_MOVES])

export function isMove(token: string): token is Move {
  return MOVE_NAMES.has(token)
}

/**
 * Works on any array of cells, not only colours: 54 for a 3x3, 24 for a
 * 2x2, 96 for a 4x4 or 150 for a 5x5 (see puzzleOf). Tests use this with numbered cells
 * to check every cell lands exactly where it should. Wide and inner-layer
 * moves only work on a 4x4 or 5x5: a 2x2 or 3x3 has no inner layer to
 * itself.
 */
export function applyMove<T>(state: readonly T[], move: Move): T[] {
  const puzzle = puzzleOf(state)
  const permutation = permutationsOf(puzzle).get(move)
  if (!permutation) throw new Error(`A ${puzzle.name} can't do ${move}`)
  return permutation.map((i) => state[i])
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

/** Parses space-separated notation such as "R U R' U2" or "Rw2 r'". */
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
