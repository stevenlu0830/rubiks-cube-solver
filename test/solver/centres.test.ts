import { beforeAll, describe, expect, it } from 'vitest'
import { centreCellsOf, centreRingsOf } from '../../src/cube/cubies.ts'
import { applyMoves, parseMoves, type Move } from '../../src/cube/moves.ts'
import { PUZZLE_4X4, PUZZLE_5X5, type Puzzle } from '../../src/cube/puzzle.ts'
import { FACES, type Face } from '../../src/cube/state.ts'
import {
  centreSteps,
  FACE_TURNS,
  INNER_TURNS,
  solveStepTogether,
  type CentreStep,
  type RingMoves,
} from '../../src/solver/centres.ts'
import { randomTurns } from '../helpers/fiveByFive.ts'
import { seededRandom } from '../helpers/seededRandom.ts'

/** How each move moves a ring with these cells (see RingMoves). */
function ringMoves(cells: readonly number[], puzzle: Puzzle): RingMoves {
  const numbered = Array.from({ length: puzzle.cellCount }, (_, i) => i)
  const slotOf = new Map(cells.map((cell, slot) => [cell, slot]))
  return (move) => {
    const from = applyMoves(numbered, [move])
    return cells.map((cell) => slotOf.get(from[cell])!)
  }
}

const ring = (kind: 'corner' | 'edge') =>
  centreRingsOf(PUZZLE_5X5).find((ring) => ring.kind === kind)!.cells
const CORNER_RING = ring('corner')
const EDGE_RING = ring('edge')
const SOLVED_5X5: Face[] = FACES.flatMap((face) => Array<Face>(25).fill(face))

/** A ring's face letters on this cube, in slot order. */
const lettersOf = (cube: readonly Face[], cells: readonly number[]) =>
  cells.map((cell) => cube[cell]).join('')

describe("a 5x5's centres", () => {
  it("have a ring of corner squares that moves exactly like a 4x4's centres", () => {
    const fourByFour = ringMoves(centreCellsOf(PUZZLE_4X4), PUZZLE_4X4)
    const fiveByFive = ringMoves(CORNER_RING, PUZZLE_5X5)
    for (const move of [...FACE_TURNS, ...INNER_TURNS]) {
      expect(fiveByFive(move)).toEqual(fourByFour(move))
    }
  })

  it('have a ring of edge squares that moves differently: an inner layer takes one from each face it turns', () => {
    const corners = ringMoves(CORNER_RING, PUZZLE_5X5)('r')
    const edges = ringMoves(EDGE_RING, PUZZLE_5X5)('r')
    const movedBy = (source: readonly number[]) =>
      source.filter((from, slot) => from !== slot).length
    expect(movedBy(corners)).toBe(8)
    expect(movedBy(edges)).toBe(4)
  })
})

describe('solveStepTogether', () => {
  let steps: (readonly [CentreStep, CentreStep])[]
  beforeAll(() => {
    const corner = centreSteps(ringMoves(CORNER_RING, PUZZLE_5X5))
    const edge = centreSteps(ringMoves(EDGE_RING, PUZZLE_5X5))
    steps = corner.map((step, i) => [step, edge[i]] as const)
  })

  /** Both rings of the cube, as solveStepTogether reads them. */
  const ringsOf = (cube: readonly Face[]) =>
    [lettersOf(cube, CORNER_RING), lettersOf(cube, EDGE_RING)] as const

  /** Whether both rings of the cube are solved. */
  const solved = (cube: readonly Face[]) =>
    ringsOf(cube).join() === ringsOf(SOLVED_5X5).join()

  /** Takes the cube through each step in turn, with these beam widths. */
  function solveCentres(cube: readonly Face[], widths?: readonly number[]) {
    const moves: Move[] = []
    let current = cube
    for (const step of steps) {
      const stepMoves = solveStepTogether(step, ringsOf(current), widths)
      moves.push(...stepMoves)
      current = applyMoves(current, stepMoves)
    }
    return { moves, after: current }
  }

  it('solves both rings of scrambled cubes in three steps, in about 40 moves', () => {
    const random = seededRandom(601)
    for (let run = 0; run < 3; run++) {
      const { moves, after } = solveCentres(
        applyMoves(SOLVED_5X5, randomTurns(100, random)),
      )
      expect(solved(after)).toBe(true)
      expect(moves.length).toBeLessThanOrEqual(55)
    }
  })

  it('needs no moves for rings already there', () => {
    expect(solveStepTogether(steps[0], ringsOf(SOLVED_5X5))).toEqual([])
    // Turning a face only turns its centres round on it.
    const turned = applyMoves(SOLVED_5X5, parseMoves("U R2 F'"))
    expect(solveCentres(turned).moves).toEqual([])
  })

  it('tries again with a wider beam when a narrow one comes to a dead end', () => {
    const cube = applyMoves(SOLVED_5X5, randomTurns(100, seededRandom(602)))
    // Keeping one position at a time always ends up going round in circles.
    expect(() => solveStepTogether(steps[0], ringsOf(cube), [1])).toThrow(
      "Couldn't solve the centres",
    )
    const { after } = solveCentres(cube, [1, 1000])
    expect(solved(after)).toBe(true)
  })

  it("refuses rings with too many of a colour, which can't be solved", () => {
    const [corners, edges] = ringsOf(SOLVED_5X5)
    // A fifth white square in the corner ring, where a red one should be.
    const fiveWhite = `${corners.slice(0, 4)}U${corners.slice(5)}`
    expect(() => solveStepTogether(steps[0], [fiveWhite, edges])).toThrow(
      "Couldn't solve the centres",
    )
  })
})
