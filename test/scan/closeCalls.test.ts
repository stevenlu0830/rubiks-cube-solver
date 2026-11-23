import { describe, expect, it } from 'vitest'
import {
  centreCellsOf,
  cornerCellsOf,
  WING_CELLS,
} from '../../src/cube/cubies.ts'
import { applyMoves, parseMoves } from '../../src/cube/moves.ts'
import { PUZZLE_2X2, PUZZLE_4X4 } from '../../src/cube/puzzle.ts'
import {
  solvedState,
  STANDARD_SCHEME,
  type Color,
  type CubeState,
} from '../../src/cube/state.ts'
import { validateCube } from '../../src/cube/validate.ts'
import type { Classified } from '../../src/scan/classify.ts'
import { settleCloseCalls } from '../../src/scan/closeCalls.ts'
import { SCRAMBLED_4X4 } from '../helpers/fourByFour.ts'

const SCRAMBLED_2X2 = applyMoves(
  solvedState(STANDARD_SCHEME, PUZZLE_2X2),
  parseMoves("R U2 F' L D B2 R' U F2"),
)

/**
 * The colours a scan named for `cube`, by cell: right, except for the
 * squares in `wrong`, each named another colour. `choices` gives the
 * second choice (and how much worse it fits) of any square; the others'
 * second choice is some other colour, fitting far worse.
 */
function named(
  cube: CubeState,
  wrong: Record<number, Color> = {},
  choices: Record<number, { color: Color; cost: number }> = {},
): Map<number, Classified> {
  return new Map(
    cube.map((color, cell) => [
      cell,
      {
        color: wrong[cell] ?? color!,
        unsure: cell in choices,
        secondChoice: choices[cell] ?? {
          color: color === 'white' ? 'yellow' : 'white',
          cost: 50,
        },
      },
    ]),
  )
}

const colorsOf = (cube: ReadonlyMap<number, Classified>) =>
  Array.from({ length: cube.size }, (_, cell) => cube.get(cell)!.color)

const cellsOf = (cube: CubeState, color: Color) =>
  cube.flatMap((cell, i) => (cell === color ? [i] : []))

/** A red square and an orange square of the scrambled 2x2, named the other way round. */
function mixedUp(cost = 2) {
  const [red] = cellsOf(SCRAMBLED_2X2, 'red')
  const [orange] = cellsOf(SCRAMBLED_2X2, 'orange')
  const wrong: Record<number, Color> = { [red]: 'orange', [orange]: 'red' }
  const choices = {
    [red]: { color: 'red' as Color, cost },
    [orange]: { color: 'orange' as Color, cost },
  }
  return { red, orange, wrong, choices }
}

describe('settleCloseCalls', () => {
  it('switches a red and an orange that were mixed up, to the cube that passes the check', () => {
    const { red, orange, wrong, choices } = mixedUp()
    const scanned = named(SCRAMBLED_2X2, wrong, choices)
    expect(validateCube(colorsOf(scanned)).valid).toBe(false)

    const settled = settleCloseCalls(scanned, 24)
    expect(colorsOf(settled)).toEqual(SCRAMBLED_2X2)
    // Still outlined for the user to check, with the other way as its second choice.
    expect(settled.get(red)).toEqual({
      color: 'red',
      unsure: true,
      secondChoice: { color: 'orange', cost: -2 },
    })
    expect(settled.get(orange)?.unsure).toBe(true)
  })

  it('tries close calls even when they were not outlined as unsure', () => {
    const { wrong, choices } = mixedUp()
    const scanned = named(SCRAMBLED_2X2, wrong, choices)
    for (const cell of Object.keys(choices)) {
      scanned.set(+cell, { ...scanned.get(+cell)!, unsure: false })
    }
    expect(colorsOf(settleCloseCalls(scanned, 24))).toEqual(SCRAMBLED_2X2)
  })

  it('leaves a cube that already passes the check as it is', () => {
    const scanned = named(SCRAMBLED_2X2)
    expect(settleCloseCalls(scanned, 24)).toBe(scanned)
  })

  it('waits until every square is named', () => {
    const { wrong, choices } = mixedUp()
    const scanned = named(SCRAMBLED_2X2, wrong, choices)
    scanned.delete(0)
    expect(settleCloseCalls(scanned, 24)).toBe(scanned)
  })

  it("doesn't change squares picked by hand", () => {
    const { wrong, choices } = mixedUp()
    const scanned = named(SCRAMBLED_2X2, wrong, choices)
    // Picked by hand: no second choice.
    for (const cell of Object.keys(choices)) {
      scanned.set(+cell, { color: wrong[+cell], unsure: false })
    }
    expect(settleCloseCalls(scanned, 24)).toBe(scanned)
  })

  it('leaves a far-fetched fix to the user: the photos must still fit', () => {
    const { wrong, choices } = mixedUp(40) // 80 in all
    const scanned = named(SCRAMBLED_2X2, wrong, choices)
    expect(settleCloseCalls(scanned, 24)).toBe(scanned)
  })

  /**
   * One corner named twisted. Untwisting it fixes the cube, and so does
   * twisting another corner the other way: two fixes, of these costs.
   */
  function twoWaysToFix(untwist: number, twistAnother: number) {
    const [first, second] = cornerCellsOf(PUZZLE_2X2)
    const turned = (cells: number[], by: number) =>
      cells.map((_, i) => SCRAMBLED_2X2[cells[(i + by) % 3]]!)
    const wrong: Record<number, Color> = {}
    const choices: Record<number, { color: Color; cost: number }> = {}
    const twisted = turned(first, 1)
    first.forEach((cell, i) => {
      wrong[cell] = twisted[i]
      choices[cell] = { color: SCRAMBLED_2X2[cell]!, cost: untwist }
    })
    const otherWay = turned(second, 2)
    second.forEach((cell, i) => {
      choices[cell] = { color: otherWay[i], cost: twistAnother }
    })
    return named(SCRAMBLED_2X2, wrong, choices)
  }

  it('keeps the fix that fits the photos best', () => {
    const settled = settleCloseCalls(twoWaysToFix(1, 2), 24)
    expect(colorsOf(settled)).toEqual(SCRAMBLED_2X2)
    // The other way passes the check too, so it wins when it fits better.
    const otherWay = colorsOf(settleCloseCalls(twoWaysToFix(2, 1), 24))
    expect(otherWay).not.toEqual(SCRAMBLED_2X2)
    expect(validateCube(otherWay).valid).toBe(true)
  })

  it("can't tell when two fixes fit just as well, so leaves it to the user", () => {
    const scanned = twoWaysToFix(1, 1)
    expect(settleCloseCalls(scanned, 24)).toBe(scanned)
  })

  it('is quick enough to run on every look through the camera', () => {
    // The worst case: 12 close calls, and no way of switching them passes.
    const { wrong } = mixedUp()
    const choices = Object.fromEntries(
      SCRAMBLED_2X2.slice(0, 12).map((color, cell) => [
        cell,
        { color: color === 'blue' ? 'green' : ('blue' as Color), cost: 1 },
      ]),
    )
    const scanned = named(SCRAMBLED_2X2, wrong, choices)
    const start = performance.now()
    settleCloseCalls(scanned, 24)
    expect(performance.now() - start).toBeLessThan(100)
  })
})

describe('settleCloseCalls on a 4x4', () => {
  const CENTRES = centreCellsOf(PUZZLE_4X4)
  const EDGE_PIECE_CELLS = WING_CELLS.flat()
  const where = (cells: readonly number[], color: Color) =>
    cells.filter((cell) => SCRAMBLED_4X4[cell] === color)
  /** A red square on an edge piece: named orange, the piece is a copy of another. */
  const [edgeRed] = where(EDGE_PIECE_CELLS, 'red')
  /** Orange centres: one named red keeps "16 of each" right, but nothing else shows it. */
  const [centreOrange] = where(CENTRES, 'orange')
  const centreReds = where(CENTRES, 'red')

  /**
   * The edge piece's red named orange: it looks more orange than red. So
   * "16 of each" named the least orange of the oranges red instead: a
   * centre that looks more orange than red.
   */
  function mixedUp() {
    const wrong: Record<number, Color> = {
      [edgeRed]: 'orange',
      [centreOrange]: 'red',
    }
    const choices: Record<number, { color: Color; cost: number }> = {
      [edgeRed]: { color: 'red', cost: 2 },
      [centreOrange]: { color: 'orange', cost: -3 },
    }
    return { wrong, choices }
  }

  it('switches a red and an orange mixed up on an edge piece and a centre', () => {
    const { wrong, choices } = mixedUp()
    const scanned = named(SCRAMBLED_4X4, wrong, choices)
    expect(validateCube(colorsOf(scanned)).valid).toBe(false)
    const settled = settleCloseCalls(scanned, 96)
    expect(colorsOf(settled)).toEqual(SCRAMBLED_4X4)
    expect(settled.get(edgeRed)?.unsure).toBe(true)
    expect(settled.get(centreOrange)?.unsure).toBe(true)
  })

  it("tries squares on pieces that can't be right first, however many closer calls there are elsewhere", () => {
    const { wrong, choices } = mixedUp()
    // 14 centres whose photos fit blue nearly as well as their colour:
    // closer calls than the edge piece's red, but no use to a fix.
    const others = CENTRES.filter(
      (cell) => cell !== centreOrange && SCRAMBLED_4X4[cell] !== 'blue',
    ).slice(0, 14)
    expect(others).toHaveLength(14)
    for (const cell of others) choices[cell] = { color: 'blue', cost: 1 }
    const settled = settleCloseCalls(named(SCRAMBLED_4X4, wrong, choices), 96)
    expect(colorsOf(settled)).toEqual(SCRAMBLED_4X4)
  })

  it('switches the centre that puts the count right and fits its photo best', () => {
    // Another centre, really red, would put the count right too, and the
    // cube would pass the check: but its photo fits orange less well.
    const { wrong, choices } = mixedUp()
    choices[centreReds[0]] = { color: 'orange', cost: 1 }
    const settled = settleCloseCalls(named(SCRAMBLED_4X4, wrong, choices), 96)
    expect(colorsOf(settled)).toEqual(SCRAMBLED_4X4)
  })

  it("can't tell which centre when two fit just as well, so leaves it to the user", () => {
    const { wrong, choices } = mixedUp()
    choices[centreReds[0]] = { color: 'orange', cost: -3 }
    const scanned = named(SCRAMBLED_4X4, wrong, choices)
    expect(settleCloseCalls(scanned, 96)).toBe(scanned)
  })

  it('leaves it to the user when too much is wrong to settle', () => {
    // Five reds and five oranges on edge pieces named the wrong way round:
    // more squares on bad pieces than can be tried.
    const wrong: Record<number, Color> = {}
    const choices: Record<number, { color: Color; cost: number }> = {}
    for (const [from, to] of [
      ['red', 'orange'],
      ['orange', 'red'],
    ] as const) {
      for (const cell of where(EDGE_PIECE_CELLS, from).slice(0, 5)) {
        wrong[cell] = to
        choices[cell] = { color: from, cost: 1 }
      }
    }
    const scanned = named(SCRAMBLED_4X4, wrong, choices)
    expect(settleCloseCalls(scanned, 96)).toBe(scanned)
  })

  it('is quick enough to run on every look through the camera', () => {
    // The worst case: a twisted corner, which no switch can fix, so no bad
    // piece to rule anything out; and 14 close calls, red and orange,
    // which keep "16 of each" in many ways.
    const [corner] = cornerCellsOf(PUZZLE_4X4)
    const wrong = Object.fromEntries(
      corner.map((cell, i) => [cell, SCRAMBLED_4X4[corner[(i + 1) % 3]]!]),
    )
    const choices: Record<number, { color: Color; cost: number }> = {}
    for (const [from, to] of [
      ['red', 'orange'],
      ['orange', 'red'],
    ] as const) {
      for (const cell of where(EDGE_PIECE_CELLS, from).slice(0, 7)) {
        choices[cell] = { color: to, cost: 1 }
      }
    }
    const scanned = named(SCRAMBLED_4X4, wrong, choices)
    expect(validateCube(colorsOf(scanned))).toMatchObject({ problem: 'twist' })
    const start = performance.now()
    expect(settleCloseCalls(scanned, 96)).toBe(scanned)
    expect(performance.now() - start).toBeLessThan(100)
  })
})
