import { describe, expect, it } from 'vitest'
import { seededRandom } from '../test/seededRandom.ts'
import { cheapestAssignment } from './assign.ts'

const total = (cost: number[][], assignment: number[]) =>
  assignment.reduce((sum, column, row) => sum + cost[row][column], 0)

/** The lowest total, found the slow way: every possible assignment. */
function bruteForce(cost: number[][]): number {
  const columns = cost[0].length
  let best = Infinity
  const tryFrom = (row: number, used: Set<number>, sum: number) => {
    if (row === cost.length) {
      best = Math.min(best, sum)
      return
    }
    for (let column = 0; column < columns; column++) {
      if (used.has(column)) continue
      used.add(column)
      tryFrom(row + 1, used, sum + cost[row][column])
      used.delete(column)
    }
  }
  tryFrom(0, new Set(), 0)
  return best
}

describe('cheapestAssignment', () => {
  it('gives each row its own column at the lowest total cost', () => {
    const cost = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ]
    const assignment = cheapestAssignment(cost)
    expect(new Set(assignment).size).toBe(3)
    expect(total(cost, assignment)).toBe(5) // 1 + 2 + 2
  })

  it('leaves spare columns unused when there are more columns than rows', () => {
    const assignment = cheapestAssignment([
      [9, 1, 9, 9],
      [9, 9, 9, 2],
    ])
    expect(assignment).toEqual([1, 3])
  })

  it('matches trying every way, on random tables', () => {
    const random = seededRandom(11)
    for (let run = 0; run < 200; run++) {
      const rows = 1 + Math.floor(random() * 5)
      const columns = rows + Math.floor(random() * 3)
      const cost = Array.from({ length: rows }, () =>
        Array.from({ length: columns }, () => Math.round(random() * 50)),
      )
      const assignment = cheapestAssignment(cost)
      expect(new Set(assignment).size).toBe(rows)
      expect(total(cost, assignment)).toBe(bruteForce(cost))
    }
  })

  it('handles a whole cube quickly: 48 squares, 54 slots', () => {
    const random = seededRandom(12)
    const cost = Array.from({ length: 48 }, () =>
      Array.from({ length: 54 }, () => random() * 100),
    )
    const started = performance.now()
    const assignment = cheapestAssignment(cost)
    expect(performance.now() - started).toBeLessThan(50)
    expect(new Set(assignment).size).toBe(48)
  })

  it('needs no columns for no rows, and refuses too few columns', () => {
    expect(cheapestAssignment([])).toEqual([])
    expect(() => cheapestAssignment([[1], [2]])).toThrow(RangeError)
  })
})
