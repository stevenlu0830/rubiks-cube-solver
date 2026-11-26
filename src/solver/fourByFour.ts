import { centreCellsOf, WING_CELLS } from '../cube/cubies.ts'
import { applyMoves, parseMoves, type Move } from '../cube/moves.ts'
import { PUZZLE_4X4 } from '../cube/puzzle.ts'
import { FACES, STANDARD_SCHEME, type Face } from '../cube/state.ts'
import { validateCube, type Problem } from '../cube/validate.ts'
import {
  moveSource,
  pairEdges,
  pairingSequences,
  solutionOf,
  turnLetters,
  type EdgePairing,
  type Pairing,
} from './bigCube.ts'
import {
  centreSteps,
  FACE_TURNS,
  solveStep,
  type CentreStep,
  type RingMoves,
} from './centres.ts'
import { initSolver as initKociemba, solveFacelets } from './kociemba.ts'
import type { Solution, StageName } from './protocol.ts'

/**
 * The 4x4 solver. It solves a 4x4 the way most people do, by "reduction":
 * turning it into something that can be solved like a 3x3.
 *
 * 1. Centres: the four centre squares of each face all one colour, in
 *    three small steps (see centres.ts). Each step has a lookup table of
 *    how many moves every position needs, so it always takes the fewest.
 * 2. Edges: the two edge pieces of each edge paired up side by side, a
 *    pair or two at a time, by short sequences that leave the centres as
 *    they were (see pairEdges in bigCube.ts). The cube now looks like a
 *    3x3 with big centres and edges.
 * 3. Parity: a 3x3 can't have just one edge flipped, or just two pieces
 *    swapped, but a 4x4 treated as a 3x3 can. A fixed sequence fixes each
 *    (see fixParity); about 3 in 4 cubes need one or both.
 * 4. Finish: solved like a 3x3, with the 3x3 solver (cubejs), using only
 *    outer face turns, which keep the centres and pairs together.
 *
 * Solutions are usually about 80 moves, at most about 100, and take a few
 * hundredths of a second after a one-off setup: about a second on a
 * computer, several on a slow phone. They're not the shortest there are
 * (no one knows how to find those quickly), but every stage is short and
 * follows on from the last.
 *
 * The cube is a string of 96 face letters (see toFaceletString), and the
 * solution never turns the whole cube, so it works as long as the user
 * holds their cube the same way throughout.
 */

const CELLS = Array.from({ length: 96 }, (_, i) => i)
const SOLVED = FACES.map((face) => face.repeat(16)).join('')

// ---------------------------------------------------------------------------
// 1. Centres

/**
 * The 24 centre cells, four to a face in the order U R F D L B, so slot
 * 4f + k is on FACES[f] (see centres.ts). Outer face turns only turn a
 * face's centres round on that face; inner-layer turns move them from face
 * to face.
 */
const CENTRES = centreCellsOf(PUZZLE_4X4)

/** How each move moves the centres (see RingMoves). */
const CENTRE_MOVES: RingMoves = (() => {
  const slotOfCell = new Map(CENTRES.map((cell, slot) => [cell, slot]))
  return (move) =>
    CENTRES.map((cell) => slotOfCell.get(moveSource(move, PUZZLE_4X4)[cell])!)
})()

/** The centres' face letters, in slot order. */
const centreFaces = (cube: string) => CENTRES.map((cell) => cube[cell]).join('')

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

/** What pairing a 4x4's edges aims for, given its pairing sequences (see pairEdges). */
function edgePairing(pairings: readonly Pairing[]): EdgePairing {
  return {
    pairings,
    faceTurns: FACE_TURNS.map((move) => edgeSource([move])),
    done: pairedEdges,
    goal: 12,
  }
}

/** Whether these moves leave a solved cube's centres solved. */
const keepsCentres = (moves: readonly Move[]) => {
  const after = turnLetters(SOLVED, moves)
  return CENTRES.every((cell) => after[cell] === SOLVED[cell])
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
    current = turnLetters(current, FLIP_FIX)
    moves.push(...FLIP_FIX)
  }
  if (threeByThreeProblem(current) === 'swap') {
    current = turnLetters(current, SWAP_FIX)
    moves.push(...SWAP_FIX)
  }
  const problem = threeByThreeProblem(current)
  if (problem) throw new Error(`Couldn't fix the parity (${problem})`)
  return moves
}

// ---------------------------------------------------------------------------
// Putting it together

interface Tables {
  centres: readonly CentreStep[]
  edges: EdgePairing
}

let tables: Tables | undefined

/** Builds the lookup tables. Takes about a second (more on a phone): call once, early. */
export function initFourByFourSolver(): void {
  if (!tables) {
    tables = {
      centres: centreSteps(CENTRE_MOVES),
      edges: edgePairing(pairingSequences(keepsCentres, edgeSource)),
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
  const { centres, edges } = tables!

  let cube = facelets
  const stages: { name: StageName; moves: Move[] }[] = []
  const stage = (name: StageName, moves: Move[]) => {
    cube = turnLetters(cube, moves)
    stages.push({ name, moves })
  }
  // Each centre step starts where the one before left off.
  let centred = cube
  const centreMoves = centres.flatMap((step) => {
    const moves = solveStep(step, centreFaces(centred))
    centred = turnLetters(centred, moves)
    return moves
  })
  stage('centres', centreMoves)
  stage('edges', pairEdges(edgeNumbers(cube), edges))
  stage('parity', fixParity(cube))
  stage('finish', solveFacelets(asThreeByThree(cube)))
  if (cube !== SOLVED) throw new Error("Couldn't solve this cube")
  return solutionOf(stages)
}
