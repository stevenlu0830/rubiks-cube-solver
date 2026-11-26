import {
  applyMoves,
  invertMoves,
  movesOf,
  parseMoves,
  type Move,
} from '../cube/moves.ts'
import { perPuzzle, puzzleOf, type Puzzle } from '../cube/puzzle.ts'
import { FACES, type Face } from '../cube/state.ts'
import { FACE_TURNS, INNER_TURNS, withTurns } from './centres.ts'
import type { Solution, Stage, StageName } from './protocol.ts'

/**
 * What the 4x4 and 5x5 solvers share, besides solving centres (see
 * centres.ts): turning a cube quickly, relabelling moves for another way of
 * holding it, pairing up edge pieces, and tidying up a solution's moves.
 */

// ---------------------------------------------------------------------------
// Turning

const sourcesOf = perPuzzle((puzzle) => {
  const cells = Array.from({ length: puzzle.cellCount }, (_, i) => i)
  return new Map<Move, readonly number[]>(
    movesOf(puzzle).map((move) => [move, applyMoves(cells, [move])]),
  )
})

/** For a move on this cube, which cell each cell's sticker comes from (see applyMove). */
export function moveSource(move: Move, puzzle: Puzzle): readonly number[] {
  return sourcesOf(puzzle).get(move)!
}

/**
 * A cube written as face letters (see toFaceletString), after these moves:
 * quick enough for the thousands of tries a solve makes.
 */
export function turnLetters(cube: string, moves: readonly Move[]): string {
  const sources = sourcesOf(puzzleOf(cube))
  let current = cube
  for (const move of moves) {
    const from = sources.get(move)!
    let next = ''
    for (let i = 0; i < from.length; i++) next += current[from[i]]
    current = next
  }
  return current
}

// ---------------------------------------------------------------------------
// Holding the cube another way round

/**
 * Relabels moves as if the cube were held another way round: each of the
 * 24 ways to hold a cube, as a map from face to face.
 */
export const HOLDINGS: readonly Record<Face, Face>[] = (() => {
  const x: Record<Face, Face> = {
    R: 'R',
    L: 'L',
    U: 'F',
    F: 'D',
    D: 'B',
    B: 'U',
  }
  const y: Record<Face, Face> = {
    U: 'U',
    D: 'D',
    F: 'R',
    R: 'B',
    B: 'L',
    L: 'F',
  }
  const found = new Map<string, Record<Face, Face>>()
  const queue = [
    Object.fromEntries(FACES.map((f) => [f, f])) as Record<Face, Face>,
  ]
  while (queue.length > 0) {
    const holding = queue.shift()!
    const key = FACES.map((face) => holding[face]).join('')
    if (found.has(key)) continue
    found.set(key, holding)
    for (const turnTo of [x, y]) {
      queue.push(
        Object.fromEntries(
          FACES.map((face) => [face, turnTo[holding[face]]]),
        ) as Record<Face, Face>,
      )
    }
  }
  return [...found.values()]
})()

export function relabel(
  moves: readonly Move[],
  holding: Record<Face, Face>,
): Move[] {
  return moves.map((move) => {
    const letter = move[0]
    const face = holding[letter.toUpperCase() as Face]
    const renamed = letter === letter.toUpperCase() ? face : face.toLowerCase()
    return `${renamed}${move.slice(1)}` as Move
  })
}

// ---------------------------------------------------------------------------
// Pairing up edges

/**
 * The middles of the edge-pairing sequences: outer face turns that, between
 * them, turn each face back as often as they turn it, apart from the top.
 * Each is used between an inner-layer turn and that turn undone.
 */
const PAIRING_MIDDLES = [
  "R U R'",
  "R U' R'",
  "R' U R",
  "R' U' R",
  "R U2 R'",
  "R U R' F R' F' R",
  "R F' U R' F",
  "F R' F' R",
  "R' F R F'",
  'R2 U2 R2',
]

/**
 * A sequence that moves edge pieces about, and what it does to them: for
 * each place in a list of the edges' places (a 4x4's edge slots, say),
 * which place its contents come from, as in applyMove.
 */
export interface Pairing {
  moves: readonly Move[]
  source: readonly number[]
}

/**
 * The pairing sequences: an inner-layer turn, which takes some edge pieces
 * away from their neighbours (and some centres with them); a middle, which
 * moves edges about but never a centre off its face; then the inner layer
 * turned back. Each middle is tried held every way round, with every
 * inner-layer turn, keeping only the ones that leave every centre as it was
 * and do something new to the edges (`edgeSource` says what moves do to
 * them): about 1,900.
 */
export function pairingSequences(
  keepsCentres: (moves: readonly Move[]) => boolean,
  edgeSource: (moves: readonly Move[]) => number[],
): Pairing[] {
  const found = new Map<string, Pairing>()
  for (const middle of PAIRING_MIDDLES) {
    for (const holding of HOLDINGS) {
      for (const inner of INNER_TURNS) {
        const moves = [
          inner,
          ...relabel(parseMoves(middle), holding),
          ...invertMoves([inner]),
        ]
        if (!keepsCentres(moves)) continue
        const source = edgeSource(moves)
        const key = source.join()
        if (source.every((from, place) => from === place) || found.has(key))
          continue
        found.set(key, { moves, source })
      }
    }
  }
  return [...found.values()]
}

/** What pairing up a cube's edges aims for, and the moves it can use (see pairEdges). */
export interface EdgePairing {
  /** The pairing sequences (see pairingSequences). */
  pairings: readonly Pairing[]
  /** What each of FACE_TURNS does to the edges, as Pairing's `source` does. */
  faceTurns: readonly (readonly number[])[]
  /** How many edges, or edge pieces, are done: the more the better. */
  done: (edges: readonly number[]) => number
  /** `done` once they all are. */
  goal: number
}

/**
 * The best next step for pairing edges: up to `setupMoves` outer face turns
 * (which move edges about but never split a pair or move a centre off its
 * face), then a pairing sequence. Best means the most gained, by
 * `pairing.done`, for each move. Null if nothing gains anything.
 */
function bestPairingStep(
  edges: readonly number[],
  pairing: EdgePairing,
  setupMoves: number,
): { moves: Move[]; edges: number[] } | null {
  const before = pairing.done(edges)
  let best: { setup: number[]; sequence: Pairing; score: number } | null = null
  // Each sequence's result goes in this one list, rather than a new one
  // each time: there are tens of thousands to try for each step.
  const after: number[] = [...edges]
  const tryFrom = (current: readonly number[], setup: number[]) => {
    for (const sequence of pairing.pairings) {
      const { source } = sequence
      for (let place = 0; place < source.length; place++) {
        after[place] = current[source[place]]
      }
      const gained = pairing.done(after) - before
      if (gained <= 0) continue
      const score = gained / (setup.length + sequence.moves.length)
      if (!best || score > best.score) best = { setup, sequence, score }
    }
    if (setup.length === setupMoves) return
    for (let i = 0; i < FACE_TURNS.length; i++) {
      // Turning the same face twice in a row is just one longer turn.
      const last = setup.at(-1)
      if (last !== undefined && Math.floor(last / 3) === Math.floor(i / 3))
        continue
      tryFrom(moved(current, pairing.faceTurns[i]), [...setup, i])
    }
  }
  tryFrom(edges, [])
  if (!best) return null
  const { setup, sequence } = best as { setup: number[]; sequence: Pairing }
  return {
    moves: [...setup.map((i) => FACE_TURNS[i]), ...sequence.moves],
    edges: moved(
      setup.reduce((current, i) => moved(current, pairing.faceTurns[i]), edges),
      sequence.source,
    ),
  }
}

const moved = (edges: readonly number[], source: readonly number[]) =>
  source.map((from) => edges[from])

/**
 * Moves that pair up every edge, a pair or two at a time, leaving the
 * centres as they were. `edges` is where the edge pieces are now, as
 * `pairing.done` reads them.
 */
export function pairEdges(
  edges: readonly number[],
  pairing: EdgePairing,
): Move[] {
  const moves: Move[] = []
  let current = edges
  while (pairing.done(current) < pairing.goal) {
    let step: ReturnType<typeof bestPairingStep> = null
    // Look further ahead only when nothing nearer pairs anything.
    for (let setupMoves = 1; setupMoves <= 3 && !step; setupMoves++) {
      step = bestPairingStep(current, pairing, setupMoves)
    }
    if (!step || moves.length > 300) throw new Error("Couldn't pair the edges")
    current = step.edges
    moves.push(...step.moves)
  }
  return moves
}

// ---------------------------------------------------------------------------
// Tidying up

/**
 * The layers of each axis that turn, from one side to the other: R r l L
 * (r is next to R, l next to L), U u d D and F f b B. A 5x5 has a middle
 * layer between r and l, but it never turns (see moves.ts), so the same
 * four layers are all there is to keep track of on either cube. Moves on
 * one axis don't affect each other, so a run of them only matters for how
 * far each layer ends up turned, which mergeTurns rewrites in the fewest
 * moves.
 */
const AXIS_LAYERS = ['RrlL', 'UudD', 'FfbB'] as const

/** Which axis a move turns, and how far it turns each layer (quarter turns, R's way). */
function layerTurns(move: Move): { axis: number; turns: number[] } {
  const letter = move[0]
  const axis = AXIS_LAYERS.findIndex((layers) => layers.includes(letter))
  const layer = AXIS_LAYERS[axis].indexOf(letter)
  const quarters = move.endsWith('2') ? 2 : move.endsWith("'") ? 3 : 1
  // The far half (l, L) turns the other way round, like L does.
  const amount = layer < 2 ? quarters : (4 - quarters) % 4
  const layers = move.includes('w') ? (layer === 0 ? [0, 1] : [2, 3]) : [layer]
  const turns = [0, 0, 0, 0]
  for (const l of layers) turns[l] = amount
  return { axis, turns }
}

/** For each axis, the fewest moves for every way its 4 layers can end up turned. */
const SHORTEST: readonly (readonly Move[])[][] = AXIS_LAYERS.map((layers) => {
  const [near, nearInner, farInner, far] = [...layers]
  const options = withTurns([
    near,
    nearInner,
    farInner,
    far,
    `${near}w`,
    `${far}w`,
  ])
  const key = (turns: readonly number[]) => turns.join('')
  const shortest = new Map<string, Move[]>([['0000', []]])
  let frontier = [[0, 0, 0, 0]]
  while (frontier.length > 0) {
    const next: number[][] = []
    for (const turns of frontier) {
      for (const option of options) {
        const after = layerTurns(option).turns.map((t, l) => (t + turns[l]) % 4)
        if (shortest.has(key(after))) continue
        shortest.set(key(after), [...shortest.get(key(turns))!, option])
        next.push(after)
      }
    }
    frontier = next
  }
  const table: Move[][] = []
  for (const [turns, moves] of shortest) table[parseInt(turns, 4)] = moves
  return table
})

/**
 * Rewrites runs of moves on the same axis in as few moves as possible:
 * "R r" becomes "Rw", "U U'" disappears, "F2 F" becomes "F'". For a 4x4 or
 * a 5x5: neither ever turns the whole cube, nor a 5x5's middle layer.
 */
export function mergeTurns(moves: readonly Move[]): Move[] {
  const merged: Move[] = []
  for (let i = 0; i < moves.length;) {
    const { axis } = layerTurns(moves[i])
    const total = [0, 0, 0, 0]
    for (; i < moves.length && layerTurns(moves[i]).axis === axis; i++) {
      layerTurns(moves[i]).turns.forEach(
        (t, l) => (total[l] = (total[l] + t) % 4),
      )
    }
    merged.push(...SHORTEST[axis][parseInt(total.join(''), 4)])
  }
  // Moves that cancel out can leave two runs on the same axis side by side.
  return merged.length < moves.length ? mergeTurns(merged) : merged
}

/**
 * A solution from its stages' moves, in order: all the moves, tidied up
 * stage by stage (see mergeTurns), and where each stage starts, leaving out
 * any with nothing to do.
 */
export function solutionOf(
  stages: readonly { name: StageName; moves: readonly Move[] }[],
): Solution {
  const moves: Move[] = []
  const starts: Stage[] = []
  for (const { name, moves: stageMoves } of stages) {
    const merged = mergeTurns(stageMoves)
    if (merged.length === 0) continue
    starts.push({ name, start: moves.length })
    moves.push(...merged)
  }
  return { moves, stages: starts }
}
