import { expect, test } from '@playwright/test'
import { EDGES, WING_CELLS } from '../src/cube/cubies.ts'
import { applyMoves, parseMoves } from '../src/cube/moves.ts'
import { cubeAsShown } from '../src/view/orientation.ts'
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

test('picks the 4x4, paints a scrambled one, and plays its solution stage by stage to the end, solved', async ({
  page,
}) => {
  // Painting 96 squares and playing about 80 moves takes a while.
  test.setTimeout(180_000)
  await page.goto('./')
  await page.getByRole('link', { name: /^4x4/ }).click()
  await expect(
    page.getByRole('heading', { name: '4x4 Cube Solver', level: 1 }),
  ).toBeVisible()
  const painter = new CubePainter(page, PUZZLE_4X4)
  await painter.paint(SCRAMBLED_4X4) // ends with the cube turned round
  await page.getByRole('button', { name: 'Solve' }).click()

  // The first time, the solver has its tables to build: give it time.
  const hold = page.getByLabel('How to hold your cube')
  await expect(hold).toBeVisible({ timeout: 30_000 })
  await expect(hold).toContainText(
    'Hold your cube so its top, front and right look just like the one on screen.',
  )
  await page.getByRole('button', { name: "I'm ready" }).click()

  // Done to the cube as it's shown, the steps solve it, in at most 110
  // moves, never turning the whole cube; and they come in stages.
  const shown = cubeAsShown(SCRAMBLED_4X4, painter.orientation)
  const steps = page.getByRole('list', { name: 'Steps' })
  const moves = parseMoves(
    (await steps.locator('.move-notation').allTextContents()).join(' '),
  )
  expect(moves.length).toBeLessThanOrEqual(110)
  expect(moves.some((move) => /^[xyz]/.test(move))).toBe(false)
  expect(isSolved(applyMoves(shown, moves))).toBe(true)
  const stages = await steps.getByRole('heading').allTextContents()
  expect(stages[0]).toBe('Centres')
  expect(stages.at(-1)).toBe('Finish like a 3x3')
  await expect(page.getByText(/^Step 1 of \d+ · Centres$/)).toBeVisible()

  // Play at double speed. It stops after each stage for a check; carry on.
  const play = page.getByRole('button', { name: 'Play', exact: true })
  const pause = page.getByRole('button', { name: 'Pause', exact: true })
  const solved = page.getByRole('heading', { name: 'Solved 🎉' })
  /** Presses Play and waits until it stops by itself. */
  const playStage = async () => {
    await play.click()
    await expect(pause).toBeVisible()
    await expect(play).toBeVisible({ timeout: 60_000 })
  }
  await page.getByRole('button', { name: /^Speed 1×/ }).click()
  await playStage()
  await expect(page.getByText(/^Centres done\./).first()).toBeVisible()
  await expect(
    page.getByText(/^Step \d+ of \d+ · Pair the edges$/),
  ).toBeVisible()
  for (let stage = 1; stage < stages.length; stage++) {
    await playStage()
    if (stage < stages.length - 1) {
      await expect(page.getByText(/ done\./).first()).toBeVisible()
    }
  }
  await expect(solved).toBeVisible()
  await expect(page.getByText(`That's all ${moves.length} moves`)).toBeVisible()

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
