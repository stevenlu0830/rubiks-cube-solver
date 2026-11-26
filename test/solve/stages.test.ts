import { describe, expect, it } from 'vitest'
import { EDGES, edgeCellsOf, wingCellsOf } from '../../src/cube/cubies.ts'
import { applyMoves, parseMoves } from '../../src/cube/moves.ts'
import { PUZZLE_4X4, PUZZLE_5X5 } from '../../src/cube/puzzle.ts'
import {
  FACES,
  solvedState,
  STANDARD_SCHEME,
  type CubeState,
} from '../../src/cube/state.ts'
import { centreColor, swappedEdge } from '../../src/solve/stages.ts'
import { toFaceletString } from '../../src/solver/facelets.ts'
import { EDGE_FIX, solveFiveByFive } from '../../src/solver/fiveByFive.ts'
import { HOLDINGS, relabel } from '../../src/solver/bigCube.ts'
import { SOLVED_5X5 } from '../helpers/fiveByFive.ts'

/** The cube at the end of the stage with this name, solving `cube`. */
function afterStage(cube: CubeState, name: string): CubeState {
  const { moves, stages } = solveFiveByFive(toFaceletString(cube))
  const next = stages.findIndex((stage) => stage.name === name) + 1
  return applyMoves(cube, moves.slice(0, stages[next]?.start ?? moves.length))
}

describe('centreColor', () => {
  it.each([PUZZLE_4X4, PUZZLE_5X5])(
    "is each face's colour once a $name's centres are solved",
    (puzzle) => {
      const solved = solvedState(STANDARD_SCHEME, puzzle)
      for (const face of FACES) {
        expect(centreColor(solved, face)).toBe(STANDARD_SCHEME[face])
      }
    },
  )

  it("reads a 5x5's centres after the centres stage, whatever the edges are doing", () => {
    const scrambled = applyMoves(
      SOLVED_5X5,
      parseMoves("R U2 F' Rw u2 L D Fw' r B2 Dw b2 R' U f L2 d' Bw l2 F"),
    )
    const centred = afterStage(scrambled, 'centres')
    expect(centreColor(centred, 'U')).toBe('white')
    expect(centreColor(centred, 'F')).toBe('green')
  })
})

describe('swappedEdge', () => {
  it('finds none on a solved 5x5, or on a 4x4, which has no middle pieces', () => {
    expect(swappedEdge(SOLVED_5X5)).toBeNull()
    expect(swappedEdge(solvedState(STANDARD_SCHEME, PUZZLE_4X4))).toBeNull()
  })

  it('finds the top-front edge after the parity fix swaps its outer pieces', () => {
    expect(swappedEdge(applyMoves(SOLVED_5X5, EDGE_FIX))).toBe('UF')
  })

  it('finds each of the 12 edges the parity fix can swap', () => {
    const found = new Set(
      HOLDINGS.map((holding) =>
        swappedEdge(applyMoves(SOLVED_5X5, relabel(EDGE_FIX, holding))),
      ),
    )
    expect([...found].sort()).toEqual([...EDGES].sort())
  })

  it('shows the swapped edge with its colours the other way round from its middle piece', () => {
    const cube = applyMoves(SOLVED_5X5, EDGE_FIX)
    const [up, front] = edgeCellsOf(PUZZLE_5X5)[EDGES.indexOf('UF')]
    const outer = wingCellsOf(PUZZLE_5X5)
      .slice(2 * EDGES.indexOf('UF'), 2 * EDGES.indexOf('UF') + 2)
      .flat()
    const onTop = outer.filter((cell) => Math.floor(cell / 25) === 0)
    expect([cube[up], cube[front]]).toEqual(['white', 'green'])
    expect(onTop.map((cell) => cube[cell])).toEqual(['green', 'green'])
  })

  it("is what's left after the edges stage when a 5x5 needs the parity fix, and gone after it", () => {
    // This scramble's solution has a parity fix.
    const scrambled = applyMoves(
      SOLVED_5X5,
      parseMoves("R U2 F' Rw u2 L D Fw' r B2 Dw b2 R' U f L2 d' Bw l2 F"),
    )
    expect(swappedEdge(afterStage(scrambled, 'edges'))).not.toBeNull()
    expect(swappedEdge(afterStage(scrambled, 'parity'))).toBeNull()

    // This one's has none, so nothing's left swapped.
    const noParity = applyMoves(SOLVED_5X5, parseMoves("R u' Fw2 l D2 b'"))
    const { stages } = solveFiveByFive(toFaceletString(noParity))
    expect(stages.map(({ name }) => name)).not.toContain('parity')
    expect(swappedEdge(afterStage(noParity, 'edges'))).toBeNull()
  })
})
