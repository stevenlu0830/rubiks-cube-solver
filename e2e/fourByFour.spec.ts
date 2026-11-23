import { expect, test } from '@playwright/test'
import { EDGES, WING_CELLS } from '../src/cube/cubies.ts'
import { applyMoves, parseMoves } from '../src/cube/moves.ts'
import { PUZZLE_4X4 } from '../src/cube/puzzle.ts'
import {
  cellIndex,
  COLORS,
  emptyState,
  isSolved,
  solvedState,
  STANDARD_SCHEME,
} from '../src/cube/state.ts'
import { CubePainter } from './cubePainter.ts'
import { savedCube, SCRAMBLED_4X4 } from './cubes.ts'
import { fakeCamera } from './fakeCamera.ts'

const count = (color: string, of: string) => `${color}, ${of}`

test('paints a scrambled 4x4 by tapping and swiping, and keeps it after a reload', async ({
  page,
}) => {
  await page.goto('./#/4x4')
  await expect(
    page.getByRole('heading', { name: '4x4 Cube Solver', level: 1 }),
  ).toBeVisible()

  await new CubePainter(page, PUZZLE_4X4).paint(SCRAMBLED_4X4)
  for (const color of COLORS) {
    await expect(
      page.getByRole('button', { name: count(color, '16/16') }),
    ).toBeVisible()
  }
  // Every one of the 96 squares went where it was tapped.
  const saved = await page.evaluate(() =>
    localStorage.getItem('rubiks-cube-solver/cube-4x4'),
  )
  expect(JSON.parse(saved!)).toEqual(SCRAMBLED_4X4)

  await page.reload()
  await expect(
    page.getByRole('button', { name: count('white', '16/16') }),
  ).toBeVisible()

  // The 3x3 has its own cube, still blank.
  await page.getByRole('link', { name: '‹ Cubes' }).click()
  await page.getByRole('link', { name: /^3x3/ }).click()
  await expect(
    page.getByRole('button', { name: count('white', '0/9') }),
  ).toBeVisible()
})

test('has Undo and Reset but no Fill centres, and no Scan yet', async ({
  page,
}) => {
  // A camera, so the only reason for no Scan button is that it's a 4x4.
  await page.addInitScript(fakeCamera)
  await page.goto('./#/4x4')

  const oneSquare = [...emptyState(PUZZLE_4X4)]
  oneSquare[cellIndex('F', 5, PUZZLE_4X4)] = 'red'
  await new CubePainter(page, PUZZLE_4X4).paint(oneSquare)
  await expect(
    page.getByRole('button', { name: count('red', '1/16') }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(
    page.getByRole('button', { name: count('red', '0/16') }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset' })).toBeDisabled()

  await expect(page.getByRole('button', { name: 'Fill centres' })).toHaveCount(
    0,
  )
  await expect(page.getByRole('button', { name: 'Scan' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Solve' })).toBeEnabled()
})

test('solves a scrambled 4x4, listing moves stage by stage that really do solve it', async ({
  page,
}) => {
  await page.addInitScript(savedCube, SCRAMBLED_4X4)
  await page.goto('./#/4x4')
  await page.getByRole('button', { name: 'Solve' }).click()

  // The first time, the solver has its tables to build: give it time.
  const solution = page.getByRole('list', { name: 'Solution' })
  await expect(solution).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('status')).toContainText(
    /^A solution in \d+ moves, in [234] stages:/,
  )
  const stages = await solution.getByRole('listitem').allTextContents()
  expect(stages[0]).toMatch(/^Centres \(\d+ moves\): /)
  expect(stages.at(-1)).toMatch(/^Finish like a 3x3 \(\d+ moves?\): /)

  // Done to the cube as painted (shown unturned), the moves solve it.
  const moves = await solution.locator('.move-notation').allTextContents()
  const all = parseMoves(moves.join(' '))
  expect(all.length).toBeLessThanOrEqual(110)
  expect(isSolved(applyMoves(SCRAMBLED_4X4, all))).toBe(true)

  // The 4x4's own solver ran, and not the 3x3's.
  const workers = page.workers().map((worker) => worker.url())
  expect(workers.some((url) => url.includes('fourByFour.worker'))).toBe(true)
  expect(workers.some((url) => url.includes('solver.worker'))).toBe(false)
})

test('points out a 4x4 painted wrong: blank squares, then an edge piece the wrong way round', async ({
  page,
}) => {
  const wrongWayRound = [...solvedState(STANDARD_SCHEME, PUZZLE_4X4)]
  const [first, second] = WING_CELLS[2 * EDGES.indexOf('UF')]
  ;[wrongWayRound[first], wrongWayRound[second]] = [
    wrongWayRound[second],
    wrongWayRound[first],
  ]
  await page.goto('./#/4x4')
  await page.getByRole('button', { name: 'Solve' }).click()
  await expect(page.getByRole('status')).toContainText(
    '96 squares are still blank.',
  )

  await page.addInitScript(savedCube, wrongWayRound)
  await page.reload()
  await page.getByRole('button', { name: 'Solve' }).click()
  await expect(page.getByRole('status')).toContainText(
    'There are two of the same white–green edge piece.',
  )
})
