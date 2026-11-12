import { describe, expect, it } from 'vitest'
import { cornerCellsOf } from '../../src/cube/cubies.ts'
import { applyMoves, parseMoves } from '../../src/cube/moves.ts'
import { PUZZLE_2X2 } from '../../src/cube/puzzle.ts'
import {
  solvedState,
  STANDARD_SCHEME,
  type Color,
  type CubeState,
} from '../../src/cube/state.ts'
import { validateCube } from '../../src/cube/validate.ts'
import type { Classified } from '../../src/scan/classify.ts'
import { settleCloseCalls } from '../../src/scan/closeCalls.ts'

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
