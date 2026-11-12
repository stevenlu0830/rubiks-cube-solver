import { cornerCellsOf, CORNERS } from '../cube/cubies.ts'
import { applyMove, type Move } from '../cube/moves.ts'
import { PUZZLE_2X2 } from '../cube/puzzle.ts'
import { FACES } from '../cube/state.ts'

/**
 * The 2x2 solver. It always finds a shortest solution, which is never more
 * than 11 moves (no 2x2 needs more, counting a half turn as one move).
 *
 * It only turns the top, right and front faces (U, R and F). That's enough
 * to solve any 2x2, and the back-bottom-left corner never moves, so it says
 * how to hold the cube: see colorsKeepingCorner in facelets.ts. With that
 * corner fixed, the other 7 corners can be in 7! = 5,040 places and 3⁶ =
 * 729 twists (the 7th corner's twist follows from the others'), so there
 * are 3,674,160 ways a 2x2 can be.
 *
 * The search is "IDA*" (iterative deepening A*): try every sequence of 0
 * moves, then 1, then 2…, so the first solution found is a shortest one.
 * To skip hopeless sequences early, two small lookup tables say at least
 * how many more moves are needed: one for where the corners are, one for
 * how they're twisted. If either says more than the moves left, that
 * branch is abandoned. Both tables take a few milliseconds to build.
 */

/** The moves the solver uses, numbered 0–8: three of each face. */
export const SOLVER_MOVES = [
  'U',
  "U'",
  'U2',
  'R',
  "R'",
  'R2',
  'F',
  "F'",
  'F2',
] as const satisfies readonly Move[]

/** No 2x2 needs more moves than this. */
export const MAX_MOVES = 11

/** The corner slot that never moves: back-bottom-left. */
const FIXED = CORNERS.indexOf('DBL')
/** The 7 corner slots that do move, in order. */
const MOVING = CORNERS.map((_, slot) => slot).filter((slot) => slot !== FIXED)

/** Ways the 7 moving corners can be placed (7!) and twisted (3⁶). */
export const PLACEMENTS = 5040
export const TWISTS = 729

/** Which corner is in each slot, and how it's twisted there (see cubies.ts). */
export interface Corners {
  cp: number[]
  co: number[]
}

/**
 * Reads the corners from facelet letters (see toFaceletString), checking
 * the cube can exist and its back-bottom-left corner is in place.
 */
export function cornersFromFacelets(facelets: string): Corners {
  if (!/^[URFDLB]{24}$/.test(facelets)) {
    throw new Error(`Not a 2x2 cube: "${facelets}"`)
  }
  const cp: number[] = []
  const co: number[] = []
  for (const cells of cornerCellsOf(PUZZLE_2X2)) {
    const faces = cells.map((cell) => facelets[cell])
    // The twist is which of the slot's three stickers shows U or D.
    const twist = faces.findIndex((face) => face === 'U' || face === 'D')
    const piece = CORNERS.findIndex((corner) =>
      [...corner].every((face, k) => face === faces[(twist + k) % 3]),
    )
    if (twist === -1 || piece === -1) {
      throw new Error(`Not a real corner: ${faces.join('')}`)
    }
    cp.push(piece)
    co.push(twist)
  }
  if (new Set(cp).size !== CORNERS.length) {
    throw new Error('A corner appears twice')
  }
  if (co.reduce((sum, twist) => sum + twist, 0) % 3 !== 0) {
    throw new Error('A corner is twisted')
  }
  if (cp[FIXED] !== FIXED || co[FIXED] !== 0) {
    throw new Error('The back-bottom-left corner is not in place')
  }
  return { cp, co }
}

/**
 * What a move does to the corners: slot i gets the corner from slot
 * from[i], twisted twist[i] more. Read off by doing the move on a solved
 * 2x2 with the app's own move engine (cube/moves.ts), so the two always
 * agree.
 */
function moveEffect(move: Move): { from: number[]; twist: number[] } {
  const solved = FACES.flatMap((face) => Array<string>(4).fill(face))
  const { cp, co } = cornersFromFacelets(applyMove(solved, move).join(''))
  return { from: cp, twist: co }
}

function applyCornerMove(
  { cp, co }: Corners,
  { from, twist }: ReturnType<typeof moveEffect>,
): Corners {
  return {
    cp: from.map((slot) => cp[slot]),
    co: from.map((slot, i) => (co[slot] + twist[i]) % 3),
  }
}

/**
 * Numbers the placement of the 7 moving corners from 0 (solved) to 5,039,
 * as a "Lehmer code": for each corner, how many after it should come before
 * it.
 */
function placementNumber(cp: readonly number[]): number {
  const order = MOVING.map((slot) => MOVING.indexOf(cp[slot]))
  let number = 0
  for (let i = 0; i < order.length; i++) {
    let smallerLater = 0
    for (let j = i + 1; j < order.length; j++) {
      if (order[j] < order[i]) smallerLater++
    }
    number = number * (order.length - i) + smallerLater
  }
  return number
}

function placementFromNumber(number: number): number[] {
  const count = MOVING.length
  const digits: number[] = []
  for (let i = count - 1; i >= 0; i--) {
    digits[i] = number % (count - i)
    number = Math.floor(number / (count - i))
  }
  const left = [...MOVING]
  const cp = CORNERS.map((_, slot) => slot) // the fixed corner stays put
  digits.forEach((digit, i) => (cp[MOVING[i]] = left.splice(digit, 1)[0]))
  return cp
}

/** Numbers the twists from 0 (none) to 728: the first 6 moving corners' twists as a base-3 number. */
function twistNumber(co: readonly number[]): number {
  return MOVING.slice(0, -1).reduce((number, slot) => number * 3 + co[slot], 0)
}

function twistFromNumber(number: number): number[] {
  const co = CORNERS.map(() => 0)
  let total = 0
  for (const slot of MOVING.slice(0, -1).reverse()) {
    co[slot] = number % 3
    total += co[slot]
    number = Math.floor(number / 3)
  }
  // The twists always add up to a multiple of 3.
  co[MOVING.at(-1)!] = (3 - (total % 3)) % 3
  return co
}

export interface Tables {
  /** placementMoves[p * 9 + m]: the placement number after move m from placement p. */
  placementMoves: Int16Array
  twistMoves: Int16Array
  /** The fewest moves that put the corners in place / untwist them, from each number. */
  placementDistance: Int8Array
  twistDistance: Int8Array
}

/** Every move from every number, then each number's distance from solved, found by spreading out from solved. */
function buildTables(): Tables {
  const effects = SOLVER_MOVES.map(moveEffect)
  const moveTable = (
    size: number,
    corners: (number: number) => Corners,
    numberOf: (corners: Corners) => number,
  ) => {
    const table = new Int16Array(size * SOLVER_MOVES.length)
    for (let n = 0; n < size; n++) {
      effects.forEach((effect, m) => {
        table[n * SOLVER_MOVES.length + m] = numberOf(
          applyCornerMove(corners(n), effect),
        )
      })
    }
    return table
  }
  const distances = (moves: Int16Array, size: number) => {
    const distance = new Int8Array(size).fill(-1)
    distance[0] = 0
    let frontier = [0]
    for (let depth = 1; frontier.length > 0; depth++) {
      const next: number[] = []
      for (const n of frontier) {
        for (let m = 0; m < SOLVER_MOVES.length; m++) {
          const after = moves[n * SOLVER_MOVES.length + m]
          if (distance[after] === -1) {
            distance[after] = depth
            next.push(after)
          }
        }
      }
      frontier = next
    }
    return distance
  }
  const unturned = CORNERS.map(() => 0)
  const inPlace = CORNERS.map((_, slot) => slot)
  const placementMoves = moveTable(
    PLACEMENTS,
    (n) => ({ cp: placementFromNumber(n), co: unturned }),
    ({ cp }) => placementNumber(cp),
  )
  const twistMoves = moveTable(
    TWISTS,
    (n) => ({ cp: inPlace, co: twistFromNumber(n) }),
    ({ co }) => twistNumber(co),
  )
  return {
    placementMoves,
    twistMoves,
    placementDistance: distances(placementMoves, PLACEMENTS),
    twistDistance: distances(twistMoves, TWISTS),
  }
}

let tables: Tables | undefined

/** The lookup tables, built the first time they're needed. */
export function solverTables(): Tables {
  tables ??= buildTables()
  return tables
}

/** Builds the lookup tables now, so the first solve is quick. */
export function initTwoByTwoSolver(): void {
  solverTables()
}

/** The placement and twist numbers of a cube, as the search works with them. */
export function cornerNumbers(corners: Corners): {
  placement: number
  twist: number
} {
  return {
    placement: placementNumber(corners.cp),
    twist: twistNumber(corners.co),
  }
}

/**
 * A shortest list of top, right and front turns that solves the 2x2
 * described by `facelets` (see toFaceletString), held so its back-bottom-
 * left corner is the one in place. Throws for a cube that can't exist.
 */
export function solveTwoByTwo(facelets: string): Move[] {
  const { placementMoves, twistMoves, placementDistance, twistDistance } =
    solverTables()
  const start = cornerNumbers(cornersFromFacelets(facelets))
  const path: number[] = []

  /** Tries to finish within `movesLeft` moves, never turning the same face twice running. */
  function search(
    placement: number,
    twist: number,
    movesLeft: number,
    lastFace: number,
  ): boolean {
    if (placement === 0 && twist === 0) return true
    const atLeast = Math.max(placementDistance[placement], twistDistance[twist])
    if (atLeast > movesLeft) return false
    for (let m = 0; m < SOLVER_MOVES.length; m++) {
      const face = Math.floor(m / 3)
      if (face === lastFace) continue
      path.push(m)
      if (
        search(
          placementMoves[placement * SOLVER_MOVES.length + m],
          twistMoves[twist * SOLVER_MOVES.length + m],
          movesLeft - 1,
          face,
        )
      ) {
        return true
      }
      path.pop()
    }
    return false
  }

  for (let length = 0; length <= MAX_MOVES; length++) {
    if (search(start.placement, start.twist, length, -1)) {
      return path.map((m) => SOLVER_MOVES[m])
    }
  }
  throw new Error('No solution found') // can't happen: every 2x2 takes at most 11
}
