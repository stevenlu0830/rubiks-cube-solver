import {
  centreRingsOf,
  edgeCellsOf,
  wingCellsOf,
  type CentreRingKind,
} from '../cube/cubies.ts'
import { applyMoves, parseMoves, type Move } from '../cube/moves.ts'
import { PUZZLE_5X5 } from '../cube/puzzle.ts'
import { FACES, STANDARD_SCHEME, type Face } from '../cube/state.ts'
import { validateCube } from '../cube/validate.ts'
import {
  HOLDINGS,
  moveSource,
  pairEdges,
  pairingSequences,
  relabel,
  solutionOf,
  turnLetters,
  type EdgePairing,
  type Pairing,
} from './bigCube.ts'
import {
  centreSteps,
  FACE_TURNS,
  solveStepTogether,
  type CentreStep,
  type RingMoves,
} from './centres.ts'
import { initSolver as initKociemba, solveFacelets } from './kociemba.ts'
import type { Solution, StageName } from './protocol.ts'

/**
 * The 5x5 solver. Like the 4x4's (see fourByFour.ts), it solves by
 * "reduction": it turns the cube into one that can be solved like a 3x3.
 * It never turns a middle layer (a 5x5 has no move for one, see moves.ts),
 * so the centre square in the middle of each face never moves, and says
 * which colour belongs on that face.
 *
 * 1. Centres: the 8 centre squares round each fixed one made its colour.
 *    They're two rings of 24 pieces (see centreRingsOf): the squares
 *    diagonally next to the fixed centres, which move exactly like a 4x4's
 *    centres, and the squares right beside them. Both rings go through the
 *    4x4's three steps at the same time (see solveStepTogether in
 *    centres.ts), with lookup tables for each ring guiding the search.
 *    That takes about 40 moves; solving one ring and then the other, with
 *    sequences that leave the first alone, would take far more, as each
 *    such sequence is 8 moves or more and moves only 3 pieces.
 * 2. Edges: each edge's two outer pieces joined to its middle piece, by the
 *    4x4's pairing sequences, which leave the centres as they were (see
 *    pairEdges in bigCube.ts). The cube now looks like a 3x3.
 * 3. Parity: in about half of all cubes, the last edge's two outer pieces
 *    end up swapped round. A fixed sequence swaps them back (see
 *    EDGE_FIX). Unlike a 4x4, a 5x5 never ends up with two edges swapped:
 *    its corners and middle edge pieces keep to a 3x3's rules.
 * 4. Finish: solved like a 3x3, with the 3x3 solver (cubejs), using only
 *    outer face turns, which keep the centres and edges together.
 *
 * Solutions are usually about 130 moves, at most about 150, and take a few
 * tenths of a second after a one-off setup: about a second on a computer,
 * several on a slow phone.
 *
 * The cube is a string of 150 face letters (see toFaceletString), and the
 * solution never turns the whole cube, so it works as long as the user
 * holds their cube the same way throughout.
 */

const CELLS = Array.from({ length: 150 }, (_, i) => i)
const SOLVED = FACES.map((face) => face.repeat(25)).join('')
const faceOf = (cell: number) => Math.floor(cell / 25)

// ---------------------------------------------------------------------------
// 1. Centres

/**
 * A ring's 24 cells, four to a face in the order U R F D L B, so slot
 * 4f + k is on FACES[f] (see centres.ts).
 */
const ringCells = (kind: CentreRingKind) =>
  centreRingsOf(PUZZLE_5X5).find((ring) => ring.kind === kind)!.cells

/** The squares diagonally next to the fixed centres. */
const CORNER_RING = ringCells('corner')
/** The squares right beside the fixed centres. */
const EDGE_RING = ringCells('edge')

/** How each move moves a ring (see RingMoves). */
function ringMoves(cells: readonly number[]): RingMoves {
  const slotOfCell = new Map(cells.map((cell, slot) => [cell, slot]))
  return (move) =>
    cells.map((cell) => slotOfCell.get(moveSource(move, PUZZLE_5X5)[cell])!)
}

/** A ring's face letters, in slot order. */
const ringFaces = (cube: string, cells: readonly number[]) =>
  cells.map((cell) => cube[cell]).join('')

/** Moves that solve both rings, a step at a time (see solveStepTogether). */
function solveCentres(
  cube: string,
  steps: readonly (readonly [CentreStep, CentreStep])[],
): Move[] {
  // Each step starts where the one before left off.
  let current = cube
  return steps.flatMap((step) => {
    const moves = solveStepTogether(step, [
      ringFaces(current, CORNER_RING),
      ringFaces(current, EDGE_RING),
    ])
    current = turnLetters(current, moves)
    return moves
  })
}

// ---------------------------------------------------------------------------
// 2. Edges

/** Each edge's middle piece's two cells, in the order of EDGES (see edgeCellsOf). */
const MIDDLES = edgeCellsOf(PUZZLE_5X5)

/**
 * Each outer edge piece's slot's two cells (see wingCellsOf), on the same
 * faces in the same order as its middle piece's: slots 2e and 2e + 1 are
 * either side of middle piece e.
 */
const OUTERS = wingCellsOf(PUZZLE_5X5).map(([a, b], slot) =>
  faceOf(a) === faceOf(MIDDLES[slot >> 1][0]) ? [a, b] : [b, a],
)

/**
 * The cells pairing up a 5x5's edges looks at, in this order: each outer
 * piece's two (see OUTERS), then each middle piece's two. Its "edges" are
 * these cells' faces, numbered 0 to 5 in the order of FACES.
 */
const EDGE_CELLS = [...OUTERS.flat(), ...MIDDLES.flat()]

/** The edges, as pairing reads them (see EDGE_CELLS). */
const edgesOf = (cube: string) =>
  EDGE_CELLS.map((cell) => FACES.indexOf(cube[cell] as Face))

/** For each place in EDGE_CELLS, which place its sticker comes from after these moves. */
function edgeSource(moves: readonly Move[]): number[] {
  const from = applyMoves(CELLS, moves)
  const placeOfCell = new Map(EDGE_CELLS.map((cell, place) => [cell, place]))
  return EDGE_CELLS.map((cell) => placeOfCell.get(from[cell])!)
}

/** Whether these moves leave a solved cube's centres solved. */
function keepsCentres(moves: readonly Move[]): boolean {
  const after = turnLetters(SOLVED, moves)
  return [...CORNER_RING, ...EDGE_RING].every(
    (cell) => after[cell] === SOLVED[cell],
  )
}

/**
 * Whether outer edge slot `slot` matches its middle piece: both colours on
 * the same faces. `swapped` checks for each colour on the other's face.
 */
function matchesMiddle(
  edges: readonly number[],
  slot: number,
  swapped = false,
): boolean {
  const outer = 2 * slot
  const middle = 48 + 2 * (slot >> 1)
  return swapped
    ? edges[outer] === edges[middle + 1] && edges[outer + 1] === edges[middle]
    : edges[outer] === edges[middle] && edges[outer + 1] === edges[middle + 1]
}

/** Whether edge `edge`'s two outer pieces are each in the other's place. */
const isSwapped = (edges: readonly number[], edge: number) =>
  matchesMiddle(edges, 2 * edge, true) &&
  matchesMiddle(edges, 2 * edge + 1, true)

/**
 * How many outer edge pieces match their middle piece. With `swapExpected`
 * (see hasEdgeParity), the two of an edge that are swapped round count as
 * matching, for one edge only: parity fixes that.
 */
function joined(edges: readonly number[], swapExpected: boolean): number {
  let count = 0
  for (let slot = 0; slot < 24; slot++) {
    if (matchesMiddle(edges, slot)) count++
  }
  if (swapExpected) {
    for (let edge = 0; edge < 12; edge++) {
      if (isSwapped(edges, edge)) return count + 2
    }
  }
  return count
}

/**
 * Each outer edge piece by the faces its two colours belong on, read in its
 * cells' order (see wingCellsOf), such as "UF".
 */
const OUTER_PIECES = new Map(
  wingCellsOf(PUZZLE_5X5).map(([a, b], piece) => [
    `${SOLVED[a]}${SOLVED[b]}`,
    piece,
  ]),
)

/**
 * Whether it takes an odd number of swaps to put every outer edge piece
 * beside its middle piece. Face turns move a middle piece and the outer
 * pieces beside it together, and the inner-layer turns in a pairing
 * sequence undo each other's swaps, so neither can change this: pairing
 * can then join every edge but one, whose outer pieces end up swapped
 * round (see EDGE_FIX).
 */
function hasEdgeParity(cube: string): boolean {
  // For each piece wanted somewhere, the piece there now: as many swaps
  // put this right as put the pieces right.
  const there: number[] = []
  wingCellsOf(PUZZLE_5X5).forEach(([a, b], slot) => {
    const middle = MIDDLES[slot >> 1]
    const [wantA, wantB] = [a, b].map(
      (cell) => cube[middle.find((m) => faceOf(m) === faceOf(cell))!],
    )
    there[OUTER_PIECES.get(`${wantA}${wantB}`)!] = OUTER_PIECES.get(
      `${cube[a]}${cube[b]}`,
    )!
  })
  // A cycle of n pieces takes n - 1 swaps.
  let odd = false
  const done = new Set<number>()
  for (let piece = 0; piece < 24; piece++) {
    for (let next = piece; !done.has(next); next = there[next]) {
      done.add(next)
      if (next !== piece) odd = !odd
    }
  }
  return odd
}

// ---------------------------------------------------------------------------
// 3. Parity, and 4. finishing like a 3x3

/**
 * Swaps the two outer pieces of the top front edge, either side of its
 * middle one. All else it does is turn the top's centre squares half way
 * round, which changes nothing once they're one colour. It's the 4x4's
 * flip fix (FLIP_FIX in fourByFour.ts), turning inner layers only: r and l
 * where that has Rw and Lw. Known as the 5x5's "edge parity" fix.
 */
export const EDGE_FIX = parseMoves("r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2")

/** For each edge, in the order of EDGES, EDGE_FIX held so that it swaps that edge's outer pieces. */
function edgeFixes(): Move[][] {
  const fixes: Move[][] = []
  for (const holding of HOLDINGS) {
    const moves = relabel(EDGE_FIX, holding)
    const edges = edgesOf(turnLetters(SOLVED, moves))
    const edge = MIDDLES.findIndex((_, edge) => isSwapped(edges, edge))
    fixes[edge] ??= moves
  }
  return fixes
}

/** The moves that swap back an edge's outer pieces, if one has them swapped round. */
function fixParity(cube: string, fixes: readonly Move[][]): Move[] {
  const edges = edgesOf(cube)
  const edge = MIDDLES.findIndex((_, edge) => isSwapped(edges, edge))
  return edge < 0 ? [] : fixes[edge]
}

/**
 * The cube as a 3x3 (54 letters): each face's corners, middle edge pieces
 * and fixed centre. Once the centres are solved and the edges joined, the
 * cells left out match the ones next to them.
 */
function asThreeByThree(cube: string): string {
  const keep = [0, 2, 4] // rows and columns: first, middle, last
  return FACES.map((_, face) =>
    keep
      .flatMap((row) =>
        keep.map((column) => cube[face * 25 + row * 5 + column]),
      )
      .join(''),
  ).join('')
}

/** Face turns that solve the cube as a 3x3 (see asThreeByThree). */
function finish(cube: string): Move[] {
  const threeByThree = asThreeByThree(cube)
  // A real 5x5 always makes a real 3x3, but the 3x3 solver can't tell if
  // it isn't one, so check.
  const colors = [...threeByThree].map((face) => STANDARD_SCHEME[face as Face])
  if (!validateCube(colors).valid) throw new Error("Couldn't solve this cube")
  return solveFacelets(threeByThree)
}

// ---------------------------------------------------------------------------
// Putting it together

interface Tables {
  /** Each step for the two rings: the ring of corner squares', then the edge squares'. */
  centres: readonly (readonly [CentreStep, CentreStep])[]
  pairings: readonly Pairing[]
  /** What each of FACE_TURNS does to the edges (see edgeSource). */
  faceTurns: readonly (readonly number[])[]
  /** See edgeFixes. */
  fixes: readonly Move[][]
}

let tables: Tables | undefined

/** Builds the lookup tables. Takes about a second (more on a phone): call once, early. */
export function initFiveByFiveSolver(): void {
  if (!tables) {
    const cornerSteps = centreSteps(ringMoves(CORNER_RING))
    const edgeSteps = centreSteps(ringMoves(EDGE_RING))
    tables = {
      centres: cornerSteps.map((step, i) => [step, edgeSteps[i]] as const),
      pairings: pairingSequences(keepsCentres, edgeSource),
      faceTurns: FACE_TURNS.map((move) => edgeSource([move])),
      fixes: edgeFixes(),
    }
  }
  initKociemba()
}

/**
 * Moves that solve the 5x5 described by `facelets` (150 face letters, see
 * toFaceletString), and where each stage starts. The cube must pass
 * validateCube. Builds the tables first if need be.
 */
export function solveFiveByFive(facelets: string): Solution {
  if (!/^[URFDLB]{150}$/.test(facelets)) {
    throw new Error(`Not a 5x5 cube: "${facelets}"`)
  }
  if (!tables) initFiveByFiveSolver()
  const { centres, pairings, faceTurns, fixes } = tables!

  let cube = facelets
  const stages: { name: StageName; moves: Move[] }[] = []
  const stage = (name: StageName, moves: Move[]) => {
    cube = turnLetters(cube, moves)
    stages.push({ name, moves })
  }
  stage('centres', solveCentres(cube, centres))
  const swapExpected = hasEdgeParity(cube)
  const pairing: EdgePairing = {
    pairings,
    faceTurns,
    done: (edges) => joined(edges, swapExpected),
    goal: 24,
  }
  stage('edges', pairEdges(edgesOf(cube), pairing))
  stage('parity', fixParity(cube, fixes))
  stage('finish', finish(cube))
  if (cube !== SOLVED) throw new Error("Couldn't solve this cube")
  return solutionOf(stages)
}
