/**
 * Settling a 2x2's close calls with the check before solving.
 *
 * A 2x2 has no centres to learn each colour from, so its photos are named
 * from typical photo colours and its own squares (see classify.ts), and
 * red and orange in particular can be hard to tell apart. Once all six
 * sides are in, the cube has to pass the same check as before solving
 * (validateCube). If it doesn't, a mix-up of two close colours is the
 * likeliest reason, and the squares it was unsure of say where to look.
 *
 * So, like the search for a side held turned, every combination of trying
 * the closest calls' second-choice colours is put through the check: the 12
 * squares whose second choice fits their photo nearly as well as their
 * colour, whether or not they were outlined as unsure (2¹² = 4,096 ways).
 * Of those that pass, the one that fits the photos best is kept, unless
 * another fits just as well: then there's no telling which is right, and
 * the user is left to check. And it must still fit the photos fairly well:
 * a mix-up of two close colours costs little, but recolouring a third of
 * the cube to get a cube that passes would be a guess.
 *
 * A side photographed turned also fails the check, with every colour
 * right, so that's looked for first (see readScannedCube).
 */

import { puzzleOf } from '../cube/puzzle.ts'
import { COLORS, type Cell, type Color } from '../cube/state.ts'
import { validateCube } from '../cube/validate.ts'
import type { Classified } from './classify.ts'

/** The most squares tried: 2 colours each, so 2¹² = 4,096 ways. */
export const MOST_TRIED = 12

/**
 * The most a fix may cost in all: how much further, added up, its squares'
 * photos are from their new colours than from their old ones (see
 * colorDistance). Switching a red and an orange that look alike costs a few
 * points; tried on made-up photos, real fixes all cost under 50, and wrong
 * ones that happened to pass the check over 100.
 */
const MOST_COST = 60

/** Fits closer together than this count as equally good. */
const TIE = 1e-9

/**
 * The cube's colours by cell, with close calls switched to their second
 * choice where that's the one clear way to a cube that passes the check.
 * Unchanged until every square is named, if it already passes, or if
 * there's no single best way.
 */
export function settleCloseCalls(
  named: ReadonlyMap<number, Classified>,
  cellCount: number,
): ReadonlyMap<number, Classified> {
  const cube: Cell[] = Array.from(
    { length: cellCount },
    (_, cell) => named.get(cell)?.color ?? null,
  )
  const check = validateCube(cube)
  if (check.valid || check.problem === 'unpainted') return named

  const { cellsPerColor } = puzzleOf(cube)
  const counts = new Map<Color, number>(COLORS.map((color) => [color, 0]))
  for (const color of cube) counts.set(color!, counts.get(color!)! + 1)
  const choices = [...named]
    .flatMap(([cell, { color, secondChoice }]) =>
      secondChoice
        ? [
            {
              cell,
              from: color,
              to: secondChoice.color,
              cost: secondChoice.cost,
            },
          ]
        : [],
    )
    .sort((x, y) => x.cost - y.cost)
    .slice(0, MOST_TRIED)

  let best: { switched: number; cost: number } | null = null
  let tied = false
  for (let switched = 1; switched < 2 ** choices.length; switched++) {
    const tried = [...cube]
    const changed = new Map(counts)
    let cost = 0
    choices.forEach(({ cell, from, to, cost: extra }, k) => {
      if (!((switched >> k) & 1)) return
      tried[cell] = to
      changed.set(from, changed.get(from)! - 1)
      changed.set(to, changed.get(to)! + 1)
      cost += extra
    })
    if (cost > MOST_COST) continue
    // Quick to rule out first: a real cube has the same number of each colour.
    if ([...changed.values()].some((count) => count !== cellsPerColor)) continue
    if (!validateCube(tried).valid) continue
    if (!best || cost < best.cost - TIE) {
      best = { switched, cost }
      tied = false
    } else if (cost <= best.cost + TIE) {
      tied = true
    }
  }
  if (!best || tied) return named

  const { switched } = best
  const settled = new Map(named)
  choices.forEach(({ cell, from, to, cost }, k) => {
    if (!((switched >> k) & 1)) return
    // Still a close call, so still outlined for the user to check.
    settled.set(cell, {
      color: to,
      unsure: true,
      secondChoice: { color: from, cost: -cost },
    })
  })
  return settled
}
