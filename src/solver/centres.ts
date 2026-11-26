import type { Move } from '../cube/moves.ts'
import { FACES, type Face } from '../cube/state.ts'

/**
 * Solving a ring of 24 centre pieces that move about: a 4x4's centres, or
 * either of a 5x5's two rings round its fixed centres (see centreRingsOf).
 * Shared by the 4x4 and 5x5 solvers.
 *
 * A ring is solved in three small steps (see centreSteps), each with a
 * lookup table of how many moves every position needs, so each step takes
 * the fewest moves there are (see solveStep). The tables only depend on how
 * the moves move the ring's pieces: a 5x5's ring of corner squares moves
 * exactly like a 4x4's centres, so it gets the very same tables. Its other
 * ring moves differently, so it gets tables of its own, and the two rings
 * take each step together (see solveStepTogether).
 *
 * A ring's 24 places ("slots") come four to a face, in the order U R F D L
 * B: slot 4f + k is on FACES[f]. Its pieces are told apart only by colour,
 * so a position is its 24 face letters in slot order, and a step only cares
 * which slots hold the colours it's placing (a "pattern").
 */

/**
 * How a move moves a ring: for each slot, which slot its piece comes from
 * (as in applyMove). Only face turns and inner-layer turns are used.
 */
export type RingMoves = (move: Move) => readonly number[]

/** Each move a quarter turn clockwise, anticlockwise (') and a half turn (2). */
export const withTurns = (bases: readonly string[]): Move[] =>
  bases.flatMap((base) => [base, `${base}'`, `${base}2`] as Move[])

/** The 18 outer face turns: R, R', R2, U… */
export const FACE_TURNS = withTurns(FACES)
/** The 18 inner-layer turns: r, r', r2, u… */
export const INNER_TURNS = withTurns(FACES.map((face) => face.toLowerCase()))

/** A face's four slots. */
export const slotsOf = (face: Face) =>
  [0, 1, 2, 3].map((k) => FACES.indexOf(face) * 4 + k)

/**
 * Which of `slots` each of them takes its piece from after a move, numbered
 * 0, 1, … in that list's order: how the move moves just those slots (which
 * it must keep to themselves).
 */
function among(
  source: readonly number[],
  slots: readonly number[],
  move: Move,
): number[] {
  return slots.map((slot) => {
    const i = slots.indexOf(source[slot])
    if (i < 0) throw new Error(`${move} moves a centre elsewhere`)
    return i
  })
}

/**
 * How a move moves a set of up to 24 slots, written as a bitmask (bit i
 * set: slot i is in the set). It runs millions of times while setting up,
 * so it's done a byte (8 bits) of the bitmask at a time, with a prepared
 * table: entry 256b + bits says where the slots in `bits`, byte b of the
 * set, go. Each move's 768 entries follow on from the last's, all in one
 * list: several times quicker than a separate function for each move.
 */
function turnTables(sources: readonly (readonly number[])[]): Int32Array {
  const tables = new Int32Array(sources.length * 768)
  sources.forEach((source, move) => {
    source.forEach((from, to) => {
      const table = move * 768 + (from >> 3) * 256
      for (let bits = 0; bits < 256; bits++) {
        if ((bits >> (from & 7)) & 1) tables[table + bits] |= 1 << to
      }
    })
  })
  return tables
}

/** The set of slots `mask` after move number `move` (see turnTables). */
function turned(tables: Int32Array, move: number, mask: number): number {
  const table = move * 768
  return (
    tables[table + (mask & 255)] |
    tables[table + 256 + ((mask >> 8) & 255)] |
    tables[table + 512 + ((mask >> 16) & 255)]
  )
}

/** binomial[n][k]: how many ways to pick k things out of n. */
const binomial: number[][] = []
for (let n = 0; n <= 24; n++) {
  binomial[n] = [1]
  for (let k = 1; k <= 24; k++) {
    binomial[n][k] = n === 0 ? 0 : binomial[n - 1][k - 1] + binomial[n - 1][k]
  }
}

/** How many bits are set in each byte. */
const BITS_IN = new Uint8Array(256)
for (let bits = 1; bits < 256; bits++) {
  BITS_IN[bits] = BITS_IN[bits >> 1] + (bits & 1)
}

/**
 * Numbers a step's patterns 0, 1, 2… for their place in its `distance`
 * list. Like turnTables, it goes a byte at a time: entry
 * (17b + before) × 256 + bits is what byte b adds, when `before` bits
 * (at most 16) are set in the bytes below it.
 */
type Numbering = Int32Array

function byteNumbering(
  adds: (byte: number, before: number, bits: number) => number,
): Numbering {
  const table = new Int32Array(3 * 17 * 256)
  for (let byte = 0; byte < 3; byte++) {
    for (let before = 0; before <= 16; before++) {
      for (let bits = 0; bits < 256; bits++) {
        table[(byte * 17 + before) * 256 + bits] = adds(byte, before, bits)
      }
    }
  }
  return table
}

/** A pattern's number (see byteNumbering). */
function numberOf(table: Numbering, pattern: number): number {
  const low = pattern & 255
  const middle = (pattern >> 8) & 255
  return (
    table[low] +
    table[(17 + BITS_IN[low]) * 256 + middle] +
    table[(34 + BITS_IN[low] + BITS_IN[middle]) * 256 + ((pattern >> 16) & 255)]
  )
}

/**
 * Numbers each set of k slots out of n 0, 1, 2… (the "combinatorial number
 * system"): the slots, lowest first, add up binomial[slot][1],
 * binomial[slot][2]…
 */
const SET_NUMBERING = byteNumbering((byte, before, bits) => {
  let number = 0
  let k = before
  for (let bit = 0; bit < 8; bit++) {
    if ((bits >> bit) & 1) number += binomial[byte * 8 + bit][++k]
  }
  return number
})

/**
 * One step of solving a ring. Its "pattern" is a bitmask saying where the
 * pieces it cares about are; `distance` says, for every pattern, the fewest
 * of its moves that reach the goal.
 */
export interface CentreStep {
  moves: readonly Move[]
  /** Each move's effect on a pattern (see turnTables). */
  turns: Int32Array
  /** Each pattern's place in `distance`. */
  numbering: Numbering
  /** Reads the pattern off the ring's 24 face letters, in slot order. */
  read: (faces: string) => number
  distance: Uint8Array
}

/** A set of slots as a bitmask: bit i for slots[i], set where `has` says. */
function maskOf(
  faces: string,
  slots: readonly number[],
  has: (face: string, i: number) => boolean,
): number {
  return slots.reduce(
    (mask, slot, i) => (has(faces[slot], i) ? mask | (1 << i) : mask),
    0,
  )
}

/**
 * Fills in `distance` by working outwards from the goal: every pattern one
 * move away needs 1 move, every new one a move from those needs 2, and so
 * on (a "breadth-first search"). The moves can all be undone by other moves
 * in the list, so the moves out from the goal are the moves back to it.
 *
 * The patterns waiting to be tried are kept as they are, not by number:
 * working a pattern out from its number took a quarter of the time.
 */
function distances(
  size: number,
  goal: number,
  turns: Int32Array,
  numbering: Numbering,
): Uint8Array {
  const moveCount = turns.length / 768
  const distance = new Uint8Array(size).fill(255)
  // Every pattern found so far, in the order found: those the same number
  // of moves from the goal are side by side.
  const found = new Int32Array(size)
  found[0] = goal
  distance[numberOf(numbering, goal)] = 0
  let start = 0
  let end = 1
  for (let depth = 1; start < end; depth++) {
    let next = end
    for (let i = start; i < end; i++) {
      const pattern = found[i]
      for (let move = 0; move < moveCount; move++) {
        const to = turned(turns, move, pattern)
        const number = numberOf(numbering, to)
        if (distance[number] === 255) {
          distance[number] = depth
          found[next++] = to
        }
      }
    }
    start = end
    end = next
  }
  if (end < size) throw new Error('A centre position is unreachable')
  return distance
}

/** A step's moves, and how each moves its slots (see turnTables). */
function stepTurns(
  ring: RingMoves,
  moves: readonly Move[],
  slots: readonly number[],
): Int32Array {
  return turnTables(moves.map((move) => among(ring(move), slots, move)))
}

const bitsOf = (slots: readonly number[], within: readonly number[]) =>
  slots.reduce((mask, slot) => mask | (1 << within.indexOf(slot)), 0)

/** All 24 slots. */
const ALL_SLOTS = Array.from({ length: 24 }, (_, slot) => slot)

/**
 * Step 1: the 8 white and yellow pieces (U and D) onto the top and bottom,
 * any way round. Any move can be used. 735,471 patterns (which 8 of the 24
 * slots they're in), at most 8 moves on a 4x4.
 */
function topAndBottomStep(ring: RingMoves): CentreStep {
  const moves = [...FACE_TURNS, ...INNER_TURNS]
  const turns = stepTurns(ring, moves, ALL_SLOTS)
  const goal = bitsOf([...slotsOf('U'), ...slotsOf('D')], ALL_SLOTS)
  return {
    moves,
    turns,
    numbering: SET_NUMBERING,
    read: (faces) =>
      maskOf(faces, ALL_SLOTS, (face) => face === 'U' || face === 'D'),
    distance: distances(binomial[24][8], goal, turns, SET_NUMBERING),
  }
}

/** The 16 slots on the four sides: R, F, L and B. */
const SIDE_SLOTS = (['R', 'F', 'L', 'B'] as const).flatMap(slotsOf)

/**
 * Step 2: the red and orange pieces (R and L) onto the right and left
 * sides, so green and blue are on the front and back. Only moves that keep
 * the top and bottom's pieces on the top and bottom: inner layers round the
 * middle (u, d), and half turns of the others. 12,870 patterns, at most 7
 * moves on a 4x4.
 */
function sidesStep(ring: RingMoves): CentreStep {
  const moves = [
    ...FACE_TURNS,
    ...withTurns(['u', 'd']),
    ...(['r2', 'l2', 'f2', 'b2'] as const),
  ]
  const turns = stepTurns(ring, moves, SIDE_SLOTS)
  const goal = bitsOf([...slotsOf('R'), ...slotsOf('L')], SIDE_SLOTS)
  return {
    moves,
    turns,
    numbering: SET_NUMBERING,
    read: (faces) =>
      maskOf(faces, SIDE_SLOTS, (face) => face === 'R' || face === 'L'),
    distance: distances(binomial[16][8], goal, turns, SET_NUMBERING),
  }
}

/**
 * Each pair of opposite faces' 8 slots, U and D, R and L, F and B, one
 * after another: a byte of a bitmask each.
 */
const AXIS_SLOTS = (
  [
    ['U', 'D'],
    ['R', 'L'],
    ['F', 'B'],
  ] as const
).flatMap(([a, b]) => [...slotsOf(a), ...slotsOf(b)])

/** The 70 ways to choose 4 of 8 slots, numbered (-1 for any other bitmask). */
const FOUR_OF_EIGHT = new Int32Array(256).fill(-1)
for (let mask = 0, count = 0; mask < 256; mask++) {
  if (BITS_IN[mask] === 4) FOUR_OF_EIGHT[mask] = count++
}

/**
 * Step 3: every piece onto its own face, keeping each pair of opposite
 * colours on its pair of faces: only half turns of inner layers. The
 * pattern is a byte for each pair of faces, of where its first colour (U,
 * R or F) is. 70 × 70 × 70 = 343,000 patterns, at most 11 moves on a 4x4.
 */
function ownFacesStep(ring: RingMoves): CentreStep {
  const moves = [
    ...FACE_TURNS,
    ...(['u2', 'd2', 'r2', 'l2', 'f2', 'b2'] as const),
  ]
  const turns = stepTurns(ring, moves, AXIS_SLOTS)
  const numbering = byteNumbering(
    (byte, _, bits) => FOUR_OF_EIGHT[bits] * [4900, 70, 1][byte],
  )
  // In each pair, the first face's 4 slots come first: 0b00001111.
  const goal = 15 | (15 << 8) | (15 << 16)
  return {
    moves,
    turns,
    numbering,
    read: (faces) =>
      maskOf(faces, AXIS_SLOTS, (face, i) => face === 'URF'[i >> 3]),
    distance: distances(343000, goal, turns, numbering),
  }
}

/**
 * The three steps that solve a ring, each starting where the last left
 * off. The steps' moves are the same for every ring, so two rings can take
 * each step together (see solveStepTogether).
 */
export function centreSteps(ring: RingMoves): CentreStep[] {
  return [topAndBottomStep(ring), sidesStep(ring), ownFacesStep(ring)]
}

/** The fewest of the step's moves from this ring's position to its goal. */
export function solveStep(step: CentreStep, faces: string): Move[] {
  const moves: Move[] = []
  let pattern = step.read(faces)
  const { turns, numbering, distance } = step
  for (let left = distance[numberOf(numbering, pattern)]; left > 0; left--) {
    // Any move one closer will do; the first found is taken.
    const move = step.moves.findIndex(
      (_, move) =>
        distance[numberOf(numbering, turned(turns, move, pattern))] ===
        left - 1,
    )
    pattern = turned(turns, move, pattern)
    moves.push(step.moves[move])
  }
  return moves
}

/**
 * How many positions solveStepTogether keeps at each depth, the first time
 * and if it has to try again. A narrower beam is quicker, but finds longer
 * solutions and now and then comes to a dead end.
 */
export const BEAM_WIDTHS: readonly number[] = [1000, 4000]

/**
 * Moves that take two rings through one step together: a 5x5's two rings,
 * which the same moves move differently. `steps` is the same step for each
 * ring (see centreSteps), and `rings` each ring's face letters, in slot
 * order.
 *
 * Each ring's table says how many moves it needs on its own, but none says
 * how many the two need together: that table would have up to hundreds of
 * billions of entries. So this finds a short way rather than the shortest,
 * by a "beam search". From each of the most promising positions so far it
 * tries every move, keeps only the most promising of the positions they
 * lead to (`width` of them), and goes on until one reaches the goal. The
 * most promising are those with the fewest moves left for the two rings
 * added together, by their tables; then, of those, the ones where the ring
 * with more to do has least.
 *
 * Now and then a search comes to a dead end, with nowhere to go it hasn't
 * been; then it tries again, keeping more positions each time (`widths`).
 */
export function solveStepTogether(
  steps: readonly [CentreStep, CentreStep],
  rings: readonly [string, string],
  widths: readonly number[] = BEAM_WIDTHS,
): Move[] {
  if (!rings.every(hasFourOfEach)) {
    throw new Error("Couldn't solve the centres: they're not a real cube's")
  }
  for (const width of widths) {
    const moves = beamSearch(steps, rings, width)
    if (moves) return moves
  }
  throw new Error("Couldn't solve the centres")
}

/** Whether a ring's 24 face letters are 4 of each, as a real cube's are. */
const hasFourOfEach = (faces: string) =>
  faces.length === 24 &&
  FACES.every((face) => faces.split(face).length - 1 === 4)

/** Far more moves than any step takes (about 25 at most, see solveStepTogether). */
const MAX_STEP_MOVES = 40

/** A position in a beam search: both rings' patterns, and how it was reached. */
interface Position {
  a: number
  b: number
  /** Its place in the last depth's beam: -1 for where the search started. */
  from: number
  /** The move from there (its place in the step's moves). */
  move: number
}

/** One search for solveStepTogether: null if it comes to a dead end. */
function beamSearch(
  [a, b]: readonly [CentreStep, CentreStep],
  [facesA, facesB]: readonly [string, string],
  width: number,
): Move[] | null {
  /**
   * Where a position ranks: lower is more promising (see
   * solveStepTogether), and 0 is the goal.
   */
  const rank = (numberA: number, numberB: number) => {
    const leftA = a.distance[numberA]
    const leftB = b.distance[numberB]
    return (leftA + leftB) * 256 + Math.max(leftA, leftB)
  }
  // Each pair of patterns gets a number of its own, to note where the
  // search has been.
  const sizeB = b.distance.length
  const seen = new Set<number>()

  const start: Position = {
    a: a.read(facesA),
    b: b.read(facesB),
    from: -1,
    move: -1,
  }
  const startA = numberOf(a.numbering, start.a)
  const startB = numberOf(b.numbering, start.b)
  if (rank(startA, startB) === 0) return []
  seen.add(startA * sizeB + startB)

  // The positions kept at each depth, the start at depth 0.
  const beams: Position[][] = [[start]]
  for (let depth = 1; depth <= MAX_STEP_MOVES; depth++) {
    const byRank: Position[][] = []
    const beam = beams[depth - 1]
    for (let from = 0; from < beam.length; from++) {
      for (let move = 0; move < a.moves.length; move++) {
        const position = {
          a: turned(a.turns, move, beam[from].a),
          b: turned(b.turns, move, beam[from].b),
          from,
          move,
        }
        const numberA = numberOf(a.numbering, position.a)
        const numberB = numberOf(b.numbering, position.b)
        if (seen.has(numberA * sizeB + numberB)) continue
        seen.add(numberA * sizeB + numberB)
        const ranked = rank(numberA, numberB)
        if (ranked === 0) return pathTo(position, beams, a.moves)
        ;(byRank[ranked] ??= []).push(position)
      }
    }
    // Most promising first; among equals, the first found.
    const kept = byRank.flat().slice(0, width)
    if (kept.length === 0) return null
    beams.push(kept)
  }
  return null
}

/** The moves that led to `position`, found by going back through the beams. */
function pathTo(
  position: Position,
  beams: readonly (readonly Position[])[],
  moves: readonly Move[],
): Move[] {
  const path: Move[] = []
  let current = position
  for (let depth = beams.length - 1; depth >= 0; depth--) {
    path.push(moves[current.move])
    current = beams[depth][current.from]
  }
  return path.reverse()
}
