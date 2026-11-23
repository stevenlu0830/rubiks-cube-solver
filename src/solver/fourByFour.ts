import { centreCellsOf, WING_CELLS } from '../cube/cubies.ts'
import {
  applyMoves,
  invertMoves,
  movesOf,
  parseMoves,
  type Move,
} from '../cube/moves.ts'
import { PUZZLE_4X4 } from '../cube/puzzle.ts'
import { FACES, STANDARD_SCHEME, type Face } from '../cube/state.ts'
import { validateCube, type Problem } from '../cube/validate.ts'
import { initSolver as initKociemba, solveFacelets } from './kociemba.ts'
import type { Solution, Stage, StageName } from './protocol.ts'

/**
 * The 4x4 solver. It solves a 4x4 the way most people do, by "reduction":
 * turning it into something that can be solved like a 3x3.
 *
 * 1. Centres: the four centre squares of each face all one colour, in
 *    three small steps (see CENTRE_STEPS). Each step has a lookup table of
 *    how many moves every position needs, so it always takes the fewest.
 * 2. Edges: the two edge pieces of each edge paired up side by side, a
 *    pair or two at a time, by short sequences that leave the centres as
 *    they were (see pairEdges). The cube now looks like a 3x3 with big
 *    centres and edges.
 * 3. Parity: a 3x3 can't have just one edge flipped, or just two pieces
 *    swapped, but a 4x4 treated as a 3x3 can. A fixed sequence fixes each
 *    (see fixParity); about 3 in 4 cubes need one or both.
 * 4. Finish: solved like a 3x3, with the 3x3 solver (cubejs), using only
 *    outer face turns, which keep the centres and pairs together.
 *
 * Solutions are usually about 80 moves, at most about 100, and take a few
 * hundredths of a second after a one-off setup of a second or two. They're
 * not the shortest there are (no one knows how to find those quickly), but
 * every stage is short and follows on from the last.
 *
 * The cube is a string of 96 face letters (see toFaceletString), and the
 * solution never turns the whole cube, so it works as long as the user
 * holds their cube the same way throughout.
 */

// ---------------------------------------------------------------------------
// Moves

const CELLS = Array.from({ length: 96 }, (_, i) => i)

/** For each move, which cell each cell's sticker comes from (see applyMove). */
const SOURCE = new Map<Move, readonly number[]>(
  movesOf(PUZZLE_4X4).map((move) => [move, applyMoves(CELLS, [move])]),
)

/** The cube after these moves. */
function turn(cube: string, moves: readonly Move[]): string {
  let current = cube
  for (const move of moves) {
    const from = SOURCE.get(move)!
    let next = ''
    for (let i = 0; i < 96; i++) next += current[from[i]]
    current = next
  }
  return current
}

const withTurns = (bases: readonly string[]): Move[] =>
  bases.flatMap((base) => [base, `${base}'`, `${base}2`] as Move[])

/** The 18 outer face turns: R, R', R2, U… */
const FACE_TURNS = withTurns(FACES)
/** The 18 inner-layer turns: r, r', r2, u… */
const INNER_TURNS = withTurns(FACES.map((face) => face.toLowerCase()))

const SOLVED = FACES.map((face) => face.repeat(16)).join('')

// ---------------------------------------------------------------------------
// 1. Centres

/**
 * The 24 centre cells, four to a face in the order U R F D L B, so slot
 * 4f + k is on FACES[f]. Outer face turns only turn a face's centres round
 * on that face; inner-layer turns move them from face to face.
 */
const CENTRES = centreCellsOf(PUZZLE_4X4)
const slotOf = (face: Face) =>
  [0, 1, 2, 3].map((k) => FACES.indexOf(face) * 4 + k)

/**
 * Which centre slot each slot's centre comes from after `move`, among
 * `slots` (which the move must keep to themselves), numbered 0, 1, … in
 * that list's order.
 */
function centreSource(move: Move, slots: readonly number[]): number[] {
  const from = SOURCE.get(move)!
  const index = new Map(slots.map((slot, i) => [CENTRES[slot], i]))
  return slots.map((slot) => {
    const i = index.get(from[CENTRES[slot]])
    if (i === undefined) throw new Error(`${move} moves a centre elsewhere`)
    return i
  })
}

/**
 * Moves a set of slots, written as a bitmask (bit i set: slot i is in the
 * set), the way a move moves their centres. It's done 8 bits at a time with
 * prepared tables, as it runs millions of times while setting up.
 */
function maskTurner(source: readonly number[]): (mask: number) => number {
  const chunks = Math.ceil(source.length / 8)
  const tables = Array.from({ length: chunks }, (_, chunk) => {
    const table = new Int32Array(256)
    for (let bits = 0; bits < 256; bits++) {
      source.forEach((from, to) => {
        const bit = from - chunk * 8
        if (bit >= 0 && bit < 8 && (bits >> bit) & 1) table[bits] |= 1 << to
      })
    }
    return table
  })
  return (mask) => {
    let moved = 0
    for (let chunk = 0; chunk < chunks; chunk++) {
      moved |= tables[chunk][(mask >> (chunk * 8)) & 255]
    }
    return moved
  }
}

/** binomial[n][k]: how many ways to pick k things out of n. */
const binomial: number[][] = []
for (let n = 0; n <= 24; n++) {
  binomial[n] = [1]
  for (let k = 1; k <= 24; k++) {
    binomial[n][k] = n === 0 ? 0 : binomial[n - 1][k - 1] + binomial[n - 1][k]
  }
}

/** Numbers each set of k slots out of n 0, 1, 2… (the "combinatorial number system"). */
function setNumber(mask: number): number {
  let number = 0
  let k = 0
  for (let rest = mask; rest !== 0; rest &= rest - 1) {
    const slot = 31 - Math.clz32(rest & -rest)
    number += binomial[slot][++k]
  }
  return number
}

/** The set of k slots out of n with this number. */
function setFromNumber(number: number, n: number, k: number): number {
  let mask = 0
  for (let slot = n - 1; slot >= 0 && k > 0; slot--) {
    if (binomial[slot][k] <= number) {
      number -= binomial[slot][k]
      mask |= 1 << slot
      k--
    }
  }
  return mask
}

/**
 * One step of solving the centres. Its "pattern" is a number saying where
 * the centres it cares about are; `distance` says, for every pattern, the
 * fewest of its moves that reach the goal.
 */
interface CentreStep {
  moves: readonly Move[]
  /** Each move's effect on a pattern. */
  turns: readonly ((pattern: number) => number)[]
  /** The pattern's place in `distance`. */
  index: (pattern: number) => number
  /** Reads the pattern off a cube. */
  read: (cube: string) => number
  distance: Uint8Array
}

/** A set of slots as a bitmask: bit i for slots[i], set where `has` says. */
function maskOf(
  cube: string,
  slots: readonly number[],
  has: (face: string) => boolean,
): number {
  return slots.reduce(
    (mask, slot, i) => (has(cube[CENTRES[slot]]) ? mask | (1 << i) : mask),
    0,
  )
}

/**
 * Fills in `distance` by working outwards from the goal: every pattern one
 * move away needs 1 move, every new one a move from those needs 2, and so
 * on (a "breadth-first search"). The moves can all be undone by other moves
 * in the list, so the moves out from the goal are the moves back to it.
 */
function distances(
  size: number,
  goal: number,
  turns: readonly ((pattern: number) => number)[],
  index: (pattern: number) => number,
  fromIndex: (index: number) => number,
): Uint8Array {
  const distance = new Uint8Array(size).fill(255)
  distance[index(goal)] = 0
  let frontier = [index(goal)]
  for (let depth = 1; frontier.length > 0; depth++) {
    const next: number[] = []
    for (const at of frontier) {
      const pattern = fromIndex(at)
      for (const turnPattern of turns) {
        const to = index(turnPattern(pattern))
        if (distance[to] === 255) {
          distance[to] = depth
          next.push(to)
        }
      }
    }
    frontier = next
  }
  if (distance.includes(255))
    throw new Error('A centre position is unreachable')
  return distance
}

/**
 * Step 1: the 8 white and yellow centres (U and D) onto the top and
 * bottom, any way round. Any move can be used. 735,471 patterns (which 8
 * of the 24 slots they're in), at most 8 moves.
 */
function topAndBottomStep(): CentreStep {
  const slots = CENTRES.map((_, slot) => slot)
  const moves = [...FACE_TURNS, ...INNER_TURNS]
  const turns = moves.map((move) => maskTurner(centreSource(move, slots)))
  const goal = [...slotOf('U'), ...slotOf('D')].reduce(
    (mask, slot) => mask | (1 << slot),
    0,
  )
  return {
    moves,
    turns,
    index: setNumber,
    read: (cube) => maskOf(cube, slots, (face) => face === 'U' || face === 'D'),
    distance: distances(binomial[24][8], goal, turns, setNumber, (number) =>
      setFromNumber(number, 24, 8),
    ),
  }
}

/** The 16 centre slots on the four sides: R, F, L and B. */
const SIDE_SLOTS = (['R', 'F', 'L', 'B'] as const).flatMap(slotOf)

/**
 * Step 2: the red and orange centres (R and L) onto the right and left
 * sides, so green and blue are on the front and back. Only moves that keep
 * the top and bottom's centres on the top and bottom: inner layers round
 * the middle (u, d), and half turns of the others. 12,870 patterns, at
 * most 7 moves.
 */
function sidesStep(): CentreStep {
  const moves = [
    ...FACE_TURNS,
    ...withTurns(['u', 'd']),
    ...(['r2', 'l2', 'f2', 'b2'] as const),
  ]
  const turns = moves.map((move) => maskTurner(centreSource(move, SIDE_SLOTS)))
  const goal = [...slotOf('R'), ...slotOf('L')].reduce(
    (mask, slot) => mask | (1 << SIDE_SLOTS.indexOf(slot)),
    0,
  )
  return {
    moves,
    turns,
    index: setNumber,
    read: (cube) =>
      maskOf(cube, SIDE_SLOTS, (face) => face === 'R' || face === 'L'),
    distance: distances(binomial[16][8], goal, turns, setNumber, (number) =>
      setFromNumber(number, 16, 8),
    ),
  }
}

/** Each pair of opposite faces' 8 centre slots: U and D, R and L, F and B. */
const AXIS_SLOTS = (
  [
    ['U', 'D'],
    ['R', 'L'],
    ['F', 'B'],
  ] as const
).map(([a, b]) => [...slotOf(a), ...slotOf(b)])

/** The 70 ways to choose 4 of 8 slots, numbered (-1 for any other bitmask). */
const FOUR_OF_EIGHT = new Int32Array(256).fill(-1)
const FOUR_OF_EIGHT_MASKS: number[] = []
for (let mask = 0; mask < 256; mask++) {
  if (popCount(mask) === 4) {
    FOUR_OF_EIGHT[mask] = FOUR_OF_EIGHT_MASKS.length
    FOUR_OF_EIGHT_MASKS.push(mask)
  }
}

function popCount(bits: number): number {
  let count = 0
  for (let rest = bits; rest !== 0; rest &= rest - 1) count++
  return count
}

/**
 * Step 3: every centre onto its own face, keeping each pair of opposite
 * colours on its pair of faces: only half turns of inner layers. The
 * pattern packs three 8-bit masks, one for each pair of faces, of where its
 * first colour (U, R or F) is. 70 × 70 × 70 = 343,000 patterns, at most 11
 * moves.
 */
function ownFacesStep(): CentreStep {
  const moves = [
    ...FACE_TURNS,
    ...(['u2', 'd2', 'r2', 'l2', 'f2', 'b2'] as const),
  ]
  const turns = moves.map((move) => {
    const [a, b, c] = AXIS_SLOTS.map((slots) =>
      maskTurner(centreSource(move, slots)),
    )
    return (pattern: number) =>
      a(pattern & 255) |
      (b((pattern >> 8) & 255) << 8) |
      (c((pattern >> 16) & 255) << 16)
  })
  const index = (pattern: number) =>
    FOUR_OF_EIGHT[pattern & 255] * 4900 +
    FOUR_OF_EIGHT[(pattern >> 8) & 255] * 70 +
    FOUR_OF_EIGHT[(pattern >> 16) & 255]
  const fromIndex = (i: number) =>
    FOUR_OF_EIGHT_MASKS[Math.floor(i / 4900)] |
    (FOUR_OF_EIGHT_MASKS[Math.floor(i / 70) % 70] << 8) |
    (FOUR_OF_EIGHT_MASKS[i % 70] << 16)
  // In each pair, the first face's 4 slots come first: 0b00001111.
  const goal = 15 | (15 << 8) | (15 << 16)
  return {
    moves,
    turns,
    index,
    read: (cube) =>
      maskOf(cube, AXIS_SLOTS[0], (face) => face === 'U') |
      (maskOf(cube, AXIS_SLOTS[1], (face) => face === 'R') << 8) |
      (maskOf(cube, AXIS_SLOTS[2], (face) => face === 'F') << 16),
    distance: distances(343000, goal, turns, index, fromIndex),
  }
}

/** The fewest of the step's moves from this cube to its goal. */
function solveStep(step: CentreStep, cube: string): Move[] {
  const moves: Move[] = []
  let pattern = step.read(cube)
  for (let left = step.distance[step.index(pattern)]; left > 0; left--) {
    // Any move one closer will do; the first found is taken.
    const i = step.turns.findIndex(
      (turnPattern) =>
        step.distance[step.index(turnPattern(pattern))] === left - 1,
    )
    pattern = step.turns[i](pattern)
    moves.push(step.moves[i])
  }
  return moves
}

// ---------------------------------------------------------------------------
// 2. Edges

/**
 * Which edge slot each edge slot's piece comes from after these moves.
 * Edge slots 2e and 2e + 1 are on the same edge (see WING_CELLS).
 */
function edgeSource(moves: readonly Move[]): number[] {
  const from = applyMoves(CELLS, moves)
  const slotOfCell = new Map(WING_CELLS.map(([first], slot) => [first, slot]))
  return WING_CELLS.map(([first]) => slotOfCell.get(from[first])!)
}

/**
 * Each edge slot's piece, told only by which edge it belongs on (its two
 * colours either way round): pieces with the same number belong together.
 */
function edgeNumbers(cube: string): number[] {
  return WING_CELLS.map(([a, b]) => {
    const [x, y] = [
      FACES.indexOf(cube[a] as Face),
      FACES.indexOf(cube[b] as Face),
    ]
    return Math.min(x, y) * 6 + Math.max(x, y)
  })
}

/** How many of the 12 edges have both their pieces side by side. */
function pairedEdges(numbers: readonly number[]): number {
  let paired = 0
  for (let slot = 0; slot < 24; slot += 2) {
    if (numbers[slot] === numbers[slot + 1]) paired++
  }
  return paired
}

const moved = (numbers: readonly number[], source: readonly number[]) =>
  source.map((from) => numbers[from])

/**
 * Relabels moves as if the cube were held another way round: each of the
 * 24 ways to hold a cube, as a map from face to face.
 */
const HOLDINGS: readonly Record<Face, Face>[] = (() => {
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

function relabel(moves: readonly Move[], holding: Record<Face, Face>): Move[] {
  return moves.map((move) => {
    const letter = move[0]
    const face = holding[letter.toUpperCase() as Face]
    const renamed = letter === letter.toUpperCase() ? face : face.toLowerCase()
    return `${renamed}${move.slice(1)}` as Move
  })
}

/**
 * The middles of the pairing sequences: outer face turns that, between
 * them, turn each face back as often as they turn it, apart from the top.
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

/** A sequence that changes which edge pieces are paired, and what it does. */
interface Pairing {
  moves: readonly Move[]
  /** Which edge slot each slot's piece comes from (see edgeSource). */
  source: readonly number[]
}

/**
 * The pairing sequences: an inner-layer turn, which takes some edge pieces
 * away from their neighbours (and some centres with them); a middle, which
 * moves edges about but never a centre off its face; then the inner layer
 * turned back. Each middle is tried held every way round, with every
 * inner-layer turn, keeping only the ones that leave every centre as it was
 * and do something new: about 1,900.
 */
function pairingSequences(): Pairing[] {
  const found = new Map<string, Pairing>()
  for (const middle of PAIRING_MIDDLES) {
    for (const holding of HOLDINGS) {
      for (const inner of INNER_TURNS) {
        const moves = [
          inner,
          ...relabel(parseMoves(middle), holding),
          ...invertMoves([inner]),
        ]
        const after = turn(SOLVED, moves)
        if (CENTRES.some((cell) => after[cell] !== SOLVED[cell])) continue
        const source = edgeSource(moves)
        const key = source.join()
        if (source.every((from, slot) => from === slot) || found.has(key))
          continue
        found.set(key, { moves, source })
      }
    }
  }
  return [...found.values()]
}

/** What the outer face turns do to the edge slots. */
const FACE_TURN_SOURCES = FACE_TURNS.map((move) => edgeSource([move]))

/**
 * The best next step for pairing edges: up to `setupMoves` outer face turns
 * (which move edges about but never split a pair or move a centre off its
 * face), then a pairing sequence. Best means the most new pairs for each
 * move. Null if nothing pairs more.
 */
function bestPairingStep(
  numbers: readonly number[],
  pairings: readonly Pairing[],
  setupMoves: number,
): Move[] | null {
  const before = pairedEdges(numbers)
  let best: { moves: Move[]; score: number } | null = null
  const tryFrom = (current: readonly number[], setup: number[]) => {
    for (const pairing of pairings) {
      const gained = pairedEdges(moved(current, pairing.source)) - before
      if (gained <= 0) continue
      const score = gained / (setup.length + pairing.moves.length)
      if (!best || score > best.score) {
        best = {
          moves: [...setup.map((i) => FACE_TURNS[i]), ...pairing.moves],
          score,
        }
      }
    }
    if (setup.length === setupMoves) return
    for (let i = 0; i < FACE_TURNS.length; i++) {
      // Turning the same face twice in a row is just one longer turn.
      const last = setup.at(-1)
      if (last !== undefined && Math.floor(last / 3) === Math.floor(i / 3))
        continue
      tryFrom(moved(current, FACE_TURN_SOURCES[i]), [...setup, i])
    }
  }
  tryFrom(numbers, [])
  return (best as { moves: Move[] } | null)?.moves ?? null
}

/** Moves that pair up every edge, leaving the centres as they were. */
function pairEdges(cube: string, pairings: readonly Pairing[]): Move[] {
  const moves: Move[] = []
  let current = cube
  while (pairedEdges(edgeNumbers(current)) < 12) {
    let step: Move[] | null = null
    // Look further ahead only when nothing nearer pairs anything.
    for (let setupMoves = 1; setupMoves <= 3 && !step; setupMoves++) {
      step = bestPairingStep(edgeNumbers(current), pairings, setupMoves)
    }
    if (!step || moves.length > 200) throw new Error("Couldn't pair the edges")
    current = turn(current, step)
    moves.push(...step)
  }
  return moves
}

// ---------------------------------------------------------------------------
// 3. Parity, and 4. finishing like a 3x3

/**
 * Flips an edge, so a cube that's a 3x3 with one edge flipped no longer is
 * (it also swaps a few other pieces, which the finish puts right). Keeps
 * the centres and pairs. Known as the "OLL parity" fix.
 */
export const FLIP_FIX = parseMoves(
  "Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2",
)

/**
 * Swaps two edges (and two pairs of corners), so a cube that's a 3x3 with
 * two pieces swapped no longer is. Keeps the centres and pairs. Known as
 * the "PLL parity" fix.
 */
export const SWAP_FIX = parseMoves('r2 U2 r2 Uw2 r2 Uw2')

/**
 * The cube as a 3x3 (54 letters): each face's corners, one cell of each
 * edge and one centre. Once the centres are solved and the edges paired,
 * the cells left out match the ones kept.
 */
function asThreeByThree(cube: string): string {
  const keep = [0, 1, 3] // rows and columns: first, an inner one, last
  return FACES.map((_, face) =>
    keep
      .flatMap((row) =>
        keep.map((column) => cube[face * 16 + row * 4 + column]),
      )
      .join(''),
  ).join('')
}

/** What's wrong with the cube as a 3x3, if it can't be one: 'flip' or 'swap'. */
function threeByThreeProblem(cube: string): Problem | null {
  const colors = [...asThreeByThree(cube)].map(
    (face) => STANDARD_SCHEME[face as Face],
  )
  const validation = validateCube(colors)
  return validation.valid ? null : validation.problem
}

/** The parity fixes this cube needs, if any. */
function fixParity(cube: string): Move[] {
  const moves: Move[] = []
  let current = cube
  if (threeByThreeProblem(current) === 'flip') {
    current = turn(current, FLIP_FIX)
    moves.push(...FLIP_FIX)
  }
  if (threeByThreeProblem(current) === 'swap') {
    current = turn(current, SWAP_FIX)
    moves.push(...SWAP_FIX)
  }
  const problem = threeByThreeProblem(current)
  if (problem) throw new Error(`Couldn't fix the parity (${problem})`)
  return moves
}

// ---------------------------------------------------------------------------
// Tidying up

/**
 * The layers of each axis, from one side to the other: R r l L (r is next
 * to R, l next to L), U u d D and F f b B. Moves on one axis don't affect
 * each other, so a run of them only matters for how far each layer ends up
 * turned, which mergeTurns rewrites in the fewest moves.
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
 * "R r" becomes "Rw", "U U'" disappears, "F2 F" becomes "F'".
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

// ---------------------------------------------------------------------------
// Putting it together

interface Tables {
  centreSteps: readonly CentreStep[]
  pairings: readonly Pairing[]
}

let tables: Tables | undefined

/** Builds the lookup tables. Takes a second or two: call once, early. */
export function initFourByFourSolver(): void {
  if (!tables) {
    tables = {
      centreSteps: [topAndBottomStep(), sidesStep(), ownFacesStep()],
      pairings: pairingSequences(),
    }
  }
  initKociemba()
}

/**
 * Moves that solve the 4x4 described by `facelets` (96 face letters, see
 * toFaceletString), and where each stage starts. The cube must pass
 * validateCube. Builds the tables first if need be.
 */
export function solveFourByFour(facelets: string): Solution {
  if (!/^[URFDLB]{96}$/.test(facelets)) {
    throw new Error(`Not a 4x4 cube: "${facelets}"`)
  }
  if (!tables) initFourByFourSolver()
  const { centreSteps, pairings } = tables!

  let cube = facelets
  const stages: { name: StageName; moves: Move[] }[] = []
  const stage = (name: StageName, moves: Move[]) => {
    cube = turn(cube, moves)
    stages.push({ name, moves: mergeTurns(moves) })
  }
  // Each centre step starts where the one before left off.
  let centred = cube
  const centreMoves = centreSteps.flatMap((step) => {
    const moves = solveStep(step, centred)
    centred = turn(centred, moves)
    return moves
  })
  stage('centres', centreMoves)
  stage('edges', pairEdges(cube, pairings))
  stage('parity', fixParity(cube))
  stage('finish', solveFacelets(asThreeByThree(cube)))
  if (cube !== SOLVED) throw new Error("Couldn't solve this cube")

  const moves: Move[] = []
  const starts: Stage[] = []
  for (const { name, moves: stageMoves } of stages) {
    if (stageMoves.length === 0) continue
    starts.push({ name, start: moves.length })
    moves.push(...stageMoves)
  }
  return { moves, stages: starts }
}
