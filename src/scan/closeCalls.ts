/**
 * Settling a 2x2's, 4x4's or 5x5's close calls with the check before
 * solving.
 *
 * Their photos are named from typical photo colours and their own squares
 * (see classify.ts), and red and orange in particular can be hard to tell
 * apart. Once all six sides are in, the cube has to pass the same check as
 * before solving (validateCube). If it doesn't, a mix-up of two close
 * colours is the likeliest reason, and the squares it was unsure of say
 * where to look.
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
 * at once: a fix must switch a square of every bad piece, leave the same
 * number of each colour, and leave every piece real, with one of each).
 * On a 2x2, too, squares on bad pieces go first. With more squares on bad
 * pieces than can be tried, too much is wrong to settle by guessing. A
 * twisted corner, a flipped edge or two pieces swapped can only be fixed
 * by switching a corner's or middle edge piece's square, so without one
 * to try, there's no need to try at all.
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
 * A 5x5 is settled the same way, trying squares on its corners, middle
 * edge pieces and outer edge pieces first. Its 48 squares round the
 * centres belong to no piece, like a 4x4's centres, but they're in two
 * rings (see centreRingsOf), each needing 4 of each colour, so a switch
 * there must also put its ring's count right. Its fixed centres are named
 * along with the colours (see classifySides), so they're never switched.
 *
 * With 150 squares, a 5x5 more often has another way to pass the check
 * that fits the photos nearly as well as the right one. So its best way
 * must fit clearly better than any other (see clearBy). Tried on 4,500
 * made-up scans of 5x5s in warm, dim and noisy light, of which 485 had
 * a square named wrong: trying 14 squares, this put right 304 of those,
 * and made a right square wrong on 8. Taking the best way however close
 * the next: 358 and 33. Trying 12 or 16 squares, or the squares in a ring
 * with too many of a colour first: no better, or slower.
 *
 * A side photographed turned also fails the check, with every colour
 * right, so that's looked for first (see readScannedCube).
 */

import {
  centreRingsOf,
  cornerCellsOf,
  edgeCellsOf,
  faceColorsOf,
  toCubies,
  wingCellsOf,
  wingsOf,
} from '../cube/cubies.ts'
import { perPuzzle, puzzleOf, type Puzzle } from '../cube/puzzle.ts'
import {
  COLORS,
  solvedState,
  type Cell,
  type Color,
  type CubeState,
} from '../cube/state.ts'
import { validateCube, type Problem } from '../cube/validate.ts'
import type { Classified } from './classify.ts'

/** The most squares tried: 2 colours each, so 2¹² = 4,096 ways (2¹⁴ = 16,384 on a 4x4 or 5x5). */
export function mostTried(puzzle: Puzzle): number {
  return puzzle.size >= 4 ? 14 : 12
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
 * How much better the best way must fit the photos than the next best way
 * that passes the check (see MOST_COST for what that's counted in), or
 * there's no telling which is right: 6 on a 5x5, and on a smaller cube,
 * any amount at all (see the top of this file).
 */
function clearBy(puzzle: Puzzle): number {
  return puzzle.name === '5x5' ? 6 : TIE
}

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
  // Two of a 5x5's centres picked the same colour by hand: no switch can help.
  if (
    check.valid ||
    check.problem === 'unpainted' ||
    check.problem === 'centers'
  ) {
    return named
  }

  const puzzle = puzzleOf(cube)
  const badPieces = badPiecesOf(cube).map((cells) => new Set(cells))
  const suspect = new Set(badPieces.flatMap((cells) => [...cells]))
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
  const tallies = talliesOf(puzzle)
  // How many of each colour each tally has now, tally by tally.
  const counts = tallies.flatMap(({ cells }) =>
    COLORS.map((color) => cells.filter((cell) => cube[cell] === color).length),
  )
  // The tallies each choice's square is in.
  const inTallies = choices.map(({ cell }) =>
    tallies.flatMap(({ has }, t) => (has.has(cell) ? [t] : [])),
  )
  // Squares of which a fix must switch at least one, each group as bits
  // of the choices on it: each bad piece's, and any needed for the
  // problem the check found (see mustTouch).
  const onBadPiece = [...badPieces, mustTouch(check.problem, puzzle)].map(
    (cells) =>
      choices.reduce(
        (bits, { cell }, k) => (cells.has(cell) ? bits | (1 << k) : bits),
        0,
      ),
  )
  if (onBadPiece.includes(0)) return named // one can't be fixed
  const piecesReal = realPiecesTest(cube, choices)

  let best: { switched: number; cost: number } | null = null
  /** How well the next best way that passes fits. */
  let nextBest = Infinity
  const change = Array<number>(counts.length)
  for (let switched = 1; switched < 2 ** choices.length; switched++) {
    if (onBadPiece.some((bits) => (switched & bits) === 0)) continue
    let cost = 0
    change.fill(0)
    for (let k = 0; k < choices.length; k++) {
      if (!((switched >> k) & 1)) continue
      cost += choices[k].cost
      for (const t of inTallies[k]) {
        change[t * COLORS.length + from[k]]--
        change[t * COLORS.length + to[k]]++
      }
    }
    if (cost > MOST_COST) continue
    // Quick to rule out first: a real cube has the right number of each
    // colour (see talliesOf).
    if (
      change.some(
        (n, i) => counts[i] + n !== tallies[Math.floor(i / COLORS.length)].each,
      )
    ) {
      continue
    }
    // Then that every piece is real, and there's one of each.
    if (!piecesReal(switched)) continue
    const tried = [...cube]
    choices.forEach(({ cell, to }, k) => {
      if ((switched >> k) & 1) tried[cell] = to
    })
    if (!validateCube(tried).valid) continue
    if (!best || cost < best.cost) {
      nextBest = best?.cost ?? Infinity
      best = { switched, cost }
    } else {
      nextBest = Math.min(nextBest, cost)
    }
  }
  if (!best || nextBest <= best.cost + clearBy(puzzle)) return named

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
 * A quick test of a way of switching squares, before the whole check:
 * whether every corner and edge piece is real (its colours belong together,
 * in an order a real piece can sit in), and there's one of each, as the
 * check needs. Only the pieces with a square that might be switched can
 * change, so only those are looked at, and what each would be is worked
 * out once, for each way of switching its squares. Most ways of switching
 * fail it, so few need the whole check, which takes much longer on a 5x5.
 * (A side held turned is looked for the same way: see turnedSides.ts.)
 */
function realPiecesTest(
  cube: CubeState,
  choices: readonly { cell: number; to: Color }[],
): (switched: number) => boolean {
  const puzzle = puzzleOf(cube)
  // The problem isn't the centres, so they say which colour each side is.
  const solved = solvedState(faceColorsOf(cube)!, puzzle)
  const kinds: [readonly (readonly number[])[], number][] = [
    // Each kind of piece, and how many ways round it can sit in a slot.
    [cornerCellsOf(puzzle), 3],
    [edgeCellsOf(puzzle), 2],
    // An outer edge piece can't be flipped in place (see wingCellsOf).
    [wingCellsOf(puzzle), 1],
  ]
  const tests = kinds.map(([slots, ways]) => {
    // Each real piece's colours, read every way it can sit, to which it is.
    const real = new Map<string, number>()
    slots.forEach((cells, piece) => {
      const colors = cells.map((cell) => solved[cell])
      for (let turn = 0; turn < ways; turn++) {
        const turned = [...colors.slice(turn), ...colors.slice(0, turn)]
        real.set(turned.join(), piece)
      }
    })
    const pieceOf = (colors: readonly Cell[]) => real.get(colors.join()) ?? -1
    // How many of each piece are in the slots no switch can change.
    const unchanged = Array<number>(slots.length).fill(0)
    let possible = true
    /** The slots that can change: the choices on each, and the piece it holds for each way of switching them. */
    const changing = slots.flatMap((cells) => {
      const on = choices.flatMap(({ cell }, k) =>
        cells.includes(cell) ? [k] : [],
      )
      if (on.length === 0) {
        const piece = pieceOf(cells.map((cell) => cube[cell]))
        if (piece === -1 || ++unchanged[piece] > 1) possible = false
        return []
      }
      const holds = Array.from({ length: 2 ** on.length }, (_, way) =>
        pieceOf(
          cells.map((cell) => {
            const j = on.findIndex((k) => choices[k].cell === cell)
            return j !== -1 && (way >> j) & 1 ? choices[on[j]].to : cube[cell]
          }),
        ),
      )
      return [{ on, holds }]
    })
    const count = Array<number>(slots.length)
    return (switched: number) => {
      if (!possible) return false
      count.splice(0, count.length, ...unchanged)
      for (const { on, holds } of changing) {
        let way = 0
        on.forEach((k, j) => (way |= ((switched >> k) & 1) << j))
        const piece = holds[way]
        if (piece === -1 || ++count[piece] > 1) return false
      }
      return true
    }
  })
  return (switched) => tests.every((test) => test(switched))
}

/**
 * The squares that must hold the right number of each colour, as the
 * check before solving counts them: the whole cube (9 of each on a 3x3,
 * 25 on a 5x5, and so on), and on a 5x5 each ring of squares round its
 * centres, 4 of each (see centreRingsOf). Counting them first rules out
 * most ways of switching at once, without the whole check.
 */
const talliesOf = perPuzzle((puzzle) => {
  const tally = (cells: readonly number[], each: number) => ({
    cells,
    has: new Set(cells),
    each,
  })
  const rings = centreRingsOf(puzzle)
  return [
    tally(
      Array.from({ length: puzzle.cellCount }, (_, cell) => cell),
      puzzle.cellsPerColor,
    ),
    // A 4x4's one ring always has 4 of each once its pieces are right.
    ...(rings.length > 1 ? rings.map(({ cells }) => tally(cells, 4)) : []),
  ]
})

/**
 * The squares a fix must switch at least one of, for a twist, a flip or a
 * swap. Those are found once every piece is real and there's one of each,
 * so they're about how the corners and middle edge pieces sit: switching
 * squares anywhere else can't help. For any other problem, every square.
 */
function mustTouch(problem: Problem, puzzle: Puzzle): ReadonlySet<number> {
  const { corners, middleEdges, all } = pieceCellsOf(puzzle)
  switch (problem) {
    case 'twist':
      return corners
    case 'flip':
      return middleEdges
    case 'swap':
      return new Set([...corners, ...middleEdges])
    default:
      return all
  }
}

/** The squares of a cube's corners, of its middle edge pieces, and all its squares. */
const pieceCellsOf = perPuzzle((puzzle) => ({
  corners: new Set(cornerCellsOf(puzzle).flat()),
  middleEdges: new Set(edgeCellsOf(puzzle).flat()),
  all: new Set(Array.from({ length: puzzle.cellCount }, (_, cell) => cell)),
}))

/**
 * The corner and edge pieces that can't be right, as their squares: each
 * one that can't exist, and each piece that appears more than once (the
 * squares of every copy). A square named wrong on a piece makes it one or
 * the other, so these are the squares to try first; and a fix must switch
 * at least one square of each. On a 5x5 that's its middle edge pieces and
 * outer ones too.
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
  const { cp, ep } = toCubies(cube)!
  return [
    ...badIn(cp, cornerCellsOf(puzzle)),
    ...badIn(ep, edgeCellsOf(puzzle)),
    ...badIn(wingsOf(cube), wingCellsOf(puzzle)),
  ]
}
