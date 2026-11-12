/**
 * Spotting a side photographed turned: the real cube was held a quarter or
 * half turn round from the 3D one, so that photo's colours went onto its
 * side turned round too. Every square is still the right colour, so "9 of
 * each" can't see it, but the pieces no longer fit together and the cube
 * fails the check before solving.
 *
 * Turning a photo round doesn't change its colours, only which square each
 * one goes on. So with the colours named once, every way of turning the six
 * photos (4 ways each: 4⁶ = 4,096) is put through the same check, which
 * works for a 2x2 or a 3x3. If exactly one of them gives a cube a real cube
 * could be, that's almost certainly what happened. Now and then a
 * far-fetched answer passes too, like turning all six sides; holding one
 * side wrong is a much likelier slip, so the answer turning the fewest
 * sides wins, unless another ties with it.
 */

import { puzzleOfSide } from '../cube/puzzle.ts'
import { FACES, type Cell, type Color, type Face } from '../cube/state.ts'
import { validateCube } from '../cube/validate.ts'
import type { Classified } from './classify.ts'
import type { Fixes, ScannedSides } from './sides.ts'

/** How many quarter turns clockwise each side's photo needs, for the sides that need any. */
export type SideTurns = Partial<Record<Face, 1 | 2 | 3>>

/**
 * For a side turned a quarter turn clockwise: which square of the side
 * (row by row from the top left) each square of the photo now shows. The
 * photo's top left shows what was the bottom left, and so on: on a 3x3
 * that's [6, 3, 0, 7, 4, 1, 8, 5, 2], on a 2x2 [2, 0, 3, 1].
 */
function quarterTurn(size: number): number[] {
  return Array.from({ length: size * size }, (_, n) => {
    const [row, column] = [Math.floor(n / size), n % size]
    return (size - 1 - column) * size + row
  })
}

/**
 * A photo's cells (see ScannedSide), for the side turned this many quarter
 * turns clockwise. Works on anything listed in photo order, such as the
 * colours read.
 */
export function turnCells<T>(cells: readonly T[], quarterTurns: number): T[] {
  const turn = quarterTurn(Math.round(Math.sqrt(cells.length)))
  let turned = [...cells]
  for (let i = 0; i < quarterTurns % 4; i++) {
    const before = turned
    turned = turn.map((from) => before[from])
  }
  return turned
}

/** Problems that turning a side round can't fix: they're about colours, not where they are. */
const NOT_ABOUT_TURNS = new Set(['unpainted', 'color-count', 'centers'])

/**
 * The sides that look photographed turned, and how far to turn each back:
 * only if the cube fails the check as it is, and one way of turning the
 * photos passes it with fewer sides turned than any other. Null otherwise,
 * including until all six are in.
 */
export function findTurnedSides(
  sides: ScannedSides,
  named: ReadonlyMap<number, Classified>,
): SideTurns | null {
  if (!FACES.every((face) => sides[face])) return null
  /** Each side's colours in photo order, and its cells turned each of the 4 ways. */
  const photos = FACES.map((face) => {
    const { cells } = sides[face]!
    return {
      colors: cells.map((cell) => named.get(cell)!.color),
      turns: [0, 1, 2, 3].map((n) => turnCells(cells, n)),
    }
  })
  const { cellCount } = puzzleOfSide(sides.F!.cells)
  const cubeTurned = (turns: readonly number[]) => {
    const cube = Array<Cell>(cellCount).fill(null)
    photos.forEach(({ colors, turns: cells }, side) =>
      cells[turns[side]].forEach((cell, n) => (cube[cell] = colors[n])),
    )
    return cube
  }

  const asIs = validateCube(cubeTurned([0, 0, 0, 0, 0, 0]))
  if (asIs.valid || NOT_ABOUT_TURNS.has(asIs.problem)) return null

  // Different ways of turning can give the same cube: a side with the same
  // colour all round looks the same turned. Those count as one answer, the
  // one turning the fewest sides.
  const answers = new Map<string, number[]>()
  for (let combination = 0; combination < 4 ** 6; combination++) {
    const turns = FACES.map((_, side) => (combination >> (2 * side)) & 3)
    const cube = cubeTurned(turns)
    if (!validateCube(cube).valid) continue
    const key = cube.join()
    const before = answers.get(key)
    if (!before || turnedCount(turns) < turnedCount(before)) {
      answers.set(key, turns)
    }
  }
  const fewest = Math.min(...[...answers.values()].map(turnedCount))
  const best = [...answers.values()].filter(
    (turns) => turnedCount(turns) === fewest,
  )
  if (best.length !== 1) return null // none, or a tie: can't tell
  const [turns] = best
  const result: SideTurns = {}
  FACES.forEach((face, side) => {
    if (turns[side] !== 0) result[face] = turns[side] as 1 | 2 | 3
  })
  return result
}

const turnedCount = (turns: readonly number[]) =>
  turns.filter((turn) => turn !== 0).length

/**
 * The sides with these turned back, and any colours picked by hand moved
 * with the squares they were picked for.
 */
export function turnSides(
  sides: ScannedSides,
  fixes: Fixes,
  turns: SideTurns,
): { sides: ScannedSides; fixes: Fixes } {
  const nextSides = { ...sides }
  const nextFixes: Partial<Record<number, Color>> = { ...fixes }
  for (const face of FACES) {
    const side = sides[face]
    const turn = turns[face]
    if (!side || !turn) continue
    const cells = turnCells(side.cells, turn)
    side.cells.forEach((cell) => delete nextFixes[cell])
    side.cells.forEach((cell, n) => {
      const fixed = fixes[cell]
      if (fixed) nextFixes[cells[n]] = fixed
    })
    nextSides[face] = { ...side, cells }
  }
  return { sides: nextSides, fixes: nextFixes }
}
