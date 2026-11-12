import { expect, test } from '@playwright/test'
import { cornerCellsOf } from '../src/cube/cubies.ts'
import { applyMoves, parseMoves } from '../src/cube/moves.ts'
import { PUZZLE_2X2 } from '../src/cube/puzzle.ts'
import {
  cellIndex,
  COLORS,
  emptyState,
  isSolved,
  solvedState,
  STANDARD_SCHEME,
} from '../src/cube/state.ts'
import { cubeAsShown } from '../src/view/orientation.ts'
import { CubePainter } from './cubePainter.ts'
import { savedCube } from './cubes.ts'
import { fakeCamera } from './fakeCamera.ts'

/** A 2x2 scrambled by a few turns of every face. */
const SCRAMBLED_2X2 = applyMoves(
  solvedState(STANDARD_SCHEME, PUZZLE_2X2),
  parseMoves("R U2 F' L D B2 R' U F2"),
)

const count = (color: string, of: string) => `${color}, ${of}`

test('paints a scrambled 2x2 by tapping and swiping, and keeps it after a reload', async ({
  page,
}) => {
  await page.goto('./#/2x2')
  await expect(
    page.getByRole('heading', { name: '2x2 Cube Solver', level: 1 }),
  ).toBeVisible()

  await new CubePainter(page, PUZZLE_2X2).paint(SCRAMBLED_2X2)
  for (const color of COLORS) {
    await expect(
      page.getByRole('button', { name: count(color, '4/4') }),
    ).toBeVisible()
  }
  // Every one of the 24 squares went where it was tapped.
  const saved = await page.evaluate(() =>
    localStorage.getItem('rubiks-cube-solver/cube-2x2'),
  )
  expect(JSON.parse(saved!)).toEqual(SCRAMBLED_2X2)

  await page.reload()
  await expect(
    page.getByRole('button', { name: count('white', '4/4') }),
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
  // A camera, so the only reason for no Scan button is that it's a 2x2.
  await page.addInitScript(fakeCamera)
  await page.goto('./#/2x2')

  const oneSquare = [...emptyState(PUZZLE_2X2)]
  oneSquare[cellIndex('F', 0, PUZZLE_2X2)] = 'red'
  await new CubePainter(page, PUZZLE_2X2).paint(oneSquare)
  await expect(
    page.getByRole('button', { name: count('red', '1/4') }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(
    page.getByRole('button', { name: count('red', '0/4') }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset' })).toBeDisabled()

  await expect(page.getByRole('button', { name: 'Fill centres' })).toHaveCount(
    0,
  )
  await expect(page.getByRole('button', { name: 'Scan' })).toHaveCount(0)
})

test('paints, swipes and solves a scrambled 2x2 with its own solver, listing the moves for the cube as seen', async ({
  page,
}) => {
  await page.goto('./#/2x2')
  const painter = new CubePainter(page, PUZZLE_2X2)
  await painter.paint(SCRAMBLED_2X2) // ends with the cube turned round
  await page.getByRole('button', { name: 'Solve' }).click()

  const status = page.getByRole('status')
  await expect(status).toContainText('The shortest solution is')
  const moves = parseMoves(
    (await status.locator('.move-notation').textContent()) ?? '',
  )
  expect(moves.length).toBeGreaterThan(0)
  expect(moves.length).toBeLessThanOrEqual(11)
  // Done to the cube as it's shown on screen, the moves solve it.
  const shown = cubeAsShown(SCRAMBLED_2X2, painter.orientation)
  expect(isSolved(applyMoves(shown, moves))).toBe(true)

  // The 2x2's solver ran, and the 3x3's (much bigger) one was never started.
  const workers = page.workers().map((worker) => worker.url())
  expect(workers.some((url) => url.includes('twoByTwo.worker'))).toBe(true)
  expect(workers.some((url) => url.includes('solver.worker'))).toBe(false)
})

test('points out a 2x2 painted wrong: blank squares, then a twisted corner', async ({
  page,
}) => {
  const twisted = [...solvedState(STANDARD_SCHEME, PUZZLE_2X2)]
  const [up, right, front] = cornerCellsOf(PUZZLE_2X2)[0] // white, red, green
  ;[twisted[up], twisted[right], twisted[front]] = ['green', 'white', 'red']
  await page.addInitScript(savedCube, twisted)
  await page.goto('./#/2x2')
  await page.getByRole('button', { name: 'Solve' }).click()
  await expect(page.getByRole('status')).toContainText('A corner is twisted')

  await page.getByRole('button', { name: 'Reset' }).click()
  await page.getByRole('button', { name: 'Solve' }).click()
  await expect(page.getByRole('status')).toContainText(
    '24 squares are still blank. Paint all 24',
  )
})
