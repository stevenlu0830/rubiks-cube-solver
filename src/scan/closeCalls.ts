/**
 * Settling a 2x2's or 4x4's close calls with the check before solving.
 *
 * Neither has a fixed centre to learn each colour from, so their photos
 * are named from typical photo colours and their own squares (see
 * classify.ts), and red and orange in particular can be hard to tell apart.
 * Once all six sides are in, the cube has to pass the same check as before
 * solving (validateCube). If it doesn't, a mix-up of two close colours is
 * the likeliest reason, and the squares it was unsure of say where to look.
 *
 * So, like the search for a side held turned, every combination of trying
 * the closest calls' second-choice colours is put through the check: on a
 * 2x2, the 12 squares whose second choice fits their photo nearly as well
 * as their colour, whether or not they were outlined as unsure (2¹² = 4,096
 * ways). Of those that pass, the one that fits the photos best is kept,
 * unless another fits just as well: then there's no telling which is right,
 * and the user is left to check. And it must still fit the photos fairly
 * well: a mix-up of two close colours costs little, but recolouring a third
 * of the cube to get a cube that passes would be a guess.
 *
 * A 4x4 has 96 squares, 32 of them red or orange, so the 12 closest calls
 * could easily miss the one that's wrong. But a square named wrong on a
 * corner or edge piece gives itself away: the piece can't exist (a corner
 * in mirror-image order, or with red and orange both), or it's a copy of
 * another piece. So squares on those pieces are tried first, then the
 * closest calls of the rest, 14 in all (2¹⁴ = 16,384 ways, most ruled out
 * at once: a fix must switch a square of every bad piece, and leave the
 * same number of each colour). On a 2x2, too, squares on bad pieces go
 * first. With more squares on bad pieces than can be tried, too much is
 * wrong to settle by guessing.
 *
 * The 24 centre squares of a 4x4 belong to no piece, so nothing shows
 * when one is wrong but "16 of each": a centre is only switched when that
 * puts a count right, and of the centres that would, the one whose photo
 * fits best wins. Two centres named the wrong way round pass the check, so
 * that can't be put right at all; they're still outlined as close calls.
 *
 * Tried on 800 made-up scans of 4x4s in warm, dim and noisy light, this
 * put right 630, and made a right square wrong on 5. Trying just the 12
 * closest calls (how this first worked, for a 2x2): 618 and 7. Trying 16
 * or 20 squares put right hardly any more, but made more wrong, and took
 * longer.
 *
 * A side photographed turned also fails the check, with every colour
 * right, so that's looked for first (see readScannedCube).
 */

import { cornerCellsOf, toCubies, WING_CELLS, wingsOf } from '../cube/cubies.ts'
import { puzzleOf, type Puzzle } from '../cube/puzzle.ts'
import { COLORS, type Cell, type Color, type CubeState } from '../cube/state.ts'
import { validateCube } from '../cube/validate.ts'
import type { Classified } from './classify.ts'

/** The most squares tried: 2 colours each, so 2¹² = 4,096 ways (2¹⁴ = 16,384 on a 4x4). */
export function mostTried(puzzle: Puzzle): number {
  return puzzle.name === '4x4' ? 14 : 12
}

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

  const puzzle = puzzleOf(cube)
  const badPieces = badPiecesOf(cube)
  const suspect = new Set(badPieces.flat())
  // More than can be tried: too much is wrong to settle by guessing.
  if (suspect.size > mostTried(puzzle)) return named
  const colorIndex = (color: Color) => COLORS.indexOf(color)
  const choices = [...named]
    .flatMap(([cell, { color, secondChoice }]) =>
      // A square that alone costs more than a fix may can't be part of one.
      secondChoice && secondChoice.cost <= MOST_COST
        ? [
            {
              cell,
              from: color,
              to: secondChoice.color,
              cost: secondChoice.cost,
              suspect: suspect.has(cell),
            },
          ]
        : [],
    )
    .sort((x, y) => Number(y.suspect) - Number(x.suspect) || x.cost - y.cost)
    .slice(0, mostTried(puzzle))
  const from = choices.map((choice) => colorIndex(choice.from))
  const to = choices.map((choice) => colorIndex(choice.to))
  const counts = COLORS.map((color) => cube.filter((c) => c === color).length)
  // For each bad piece, the choices on it, as bits: a fix must switch one.
  const onBadPiece = badPieces.map((cells) =>
    choices.reduce(
      (bits, { cell }, k) => (cells.includes(cell) ? bits | (1 << k) : bits),
      0,
    ),
  )
  if (onBadPiece.includes(0)) return named // one can't be fixed

  let best: { switched: number; cost: number } | null = null
  let tied = false
  const change = Array<number>(COLORS.length)
  for (let switched = 1; switched < 2 ** choices.length; switched++) {
    if (onBadPiece.some((bits) => (switched & bits) === 0)) continue
    let cost = 0
    change.fill(0)
    for (let k = 0; k < choices.length; k++) {
      if (!((switched >> k) & 1)) continue
      cost += choices[k].cost
      change[from[k]]--
      change[to[k]]++
    }
    if (cost > MOST_COST) continue
    // Quick to rule out first: a real cube has the same number of each colour.
    if (change.some((n, i) => counts[i] + n !== puzzle.cellsPerColor)) continue
    const tried = [...cube]
    choices.forEach(({ cell, to }, k) => {
      if ((switched >> k) & 1) tried[cell] = to
    })
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

/**
 * The corner and edge pieces that can't be right, as their squares: each
 * one that can't exist, and each piece that appears more than once (the
 * squares of every copy). A square named wrong on a piece makes it one or
 * the other, so these are the squares to try first; and a fix must switch
 * at least one square of each.
 */
function badPiecesOf(cube: CubeState): number[][] {
  const puzzle = puzzleOf(cube)
  const badIn = (
    pieces: readonly number[],
    cellsOf: readonly (readonly number[])[],
  ): number[][] => {
    const impossible = pieces.flatMap((piece, slot) =>
      piece === -1 ? [[...cellsOf[slot]]] : [],
    )
    const repeated = [...new Set(pieces)]
      .filter((piece) => piece !== -1)
      .map((piece) =>
        pieces.flatMap((other, slot) =>
          other === piece ? [...cellsOf[slot]] : [],
        ),
      )
      .filter((cells) => cells.length > cellsOf[0].length)
    return [...impossible, ...repeated]
  }
  return [
    ...badIn(toCubies(cube)!.cp, cornerCellsOf(puzzle)),
    ...(puzzle.name === '4x4' ? badIn(wingsOf(cube), WING_CELLS) : []),
  ]
}
