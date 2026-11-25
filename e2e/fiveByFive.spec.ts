import { expect, test, type Page } from '@playwright/test'
import { EDGES, wingCellsOf } from '../src/cube/cubies.ts'
import { PUZZLE_5X5 } from '../src/cube/puzzle.ts'
import {
  cellIndex,
  centerCell,
  COLORS,
  emptyState,
  FACES,
  STANDARD_SCHEME,
} from '../src/cube/state.ts'
import { CubePainter } from './cubePainter.ts'
import { savedCube, SCRAMBLED_5X5 } from './cubes.ts'
import { fakeCamera } from './fakeCamera.ts'

const count = (color: string, of: string) => `${color}, ${of}`

/** The 5x5 as saved in the browser. */
const savedFiveByFive = async (page: Page) =>
  JSON.parse(
    (await page.evaluate(() =>
      localStorage.getItem('rubiks-cube-solver/cube-5x5'),
    )) ?? 'null',
  )

test('paints a scrambled 5x5 by tapping and swiping, and keeps it after a reload', async ({
  page,
}) => {
  // 150 taps, each redrawing the cube. On a CI machine, with no graphics
  // chip to draw it, that alone takes over a minute: half again a 4x4's.
  test.slow()
  await page.goto('./#/5x5')
  await expect(
    page.getByRole('heading', { name: '5x5 Cube Solver', level: 1 }),
  ).toBeVisible()

  await new CubePainter(page, PUZZLE_5X5).paint(SCRAMBLED_5X5)
  for (const color of COLORS) {
    await expect(
      page.getByRole('button', { name: count(color, '25/25') }),
    ).toBeVisible()
  }
  // Every one of the 150 squares went where it was tapped.
  expect(await savedFiveByFive(page)).toEqual(SCRAMBLED_5X5)

  await page.reload()
  await expect(
    page.getByRole('button', { name: count('white', '25/25') }),
  ).toBeVisible()

  // The 3x3 has its own cube, still blank.
  await page.getByRole('link', { name: '‹ Cubes' }).click()
  await page.getByRole('link', { name: /^3x3/ }).click()
  await expect(
    page.getByRole('button', { name: count('white', '0/9') }),
  ).toBeVisible()
})

test('fills the six fixed centres, and has Undo and Reset', async ({
  page,
}) => {
  await page.goto('./#/5x5')
  await page.getByRole('button', { name: 'Fill centres' }).click()
  for (const color of COLORS) {
    await expect(
      page.getByRole('button', { name: count(color, '1/25') }),
    ).toBeVisible()
  }
  await expect(
    page.getByRole('button', { name: 'Fill centres' }),
  ).toBeDisabled()
  const filled = [...emptyState(PUZZLE_5X5)]
  for (const face of FACES) {
    filled[centerCell(face, PUZZLE_5X5)] = STANDARD_SCHEME[face]
  }
  expect(await savedFiveByFive(page)).toEqual(filled)

  // Paint one more square after turning the cube round to see the top.
  const oneMore = [...emptyState(PUZZLE_5X5)]
  oneMore[cellIndex('U', 0, PUZZLE_5X5)] = 'red'
  await new CubePainter(page, PUZZLE_5X5).paint(oneMore)
  await expect(
    page.getByRole('button', { name: count('red', '2/25') }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(
    page.getByRole('button', { name: count('red', '1/25') }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(
    page.getByRole('button', { name: count('red', '0/25') }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Fill centres' })).toBeEnabled()
})

test('has no Scan or Solve yet, but checks a painted 5x5, outlining a mistake until it is put right', async ({
  page,
}) => {
  // One of the top-front edge's outer pieces painted the wrong way round.
  const [first, second] = wingCellsOf(PUZZLE_5X5)[2 * EDGES.indexOf('UF')]
  const mistake = [...SCRAMBLED_5X5]
  mistake[first] = SCRAMBLED_5X5[second]
  mistake[second] = SCRAMBLED_5X5[first]
  await page.addInitScript(savedCube, mistake)
  // A camera, so the only reason for no Scan button is that it's a 5x5.
  await page.addInitScript(fakeCamera)
  await page.goto('./#/5x5')
  await expect(
    page.getByRole('button', { name: count('white', '25/25') }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Scan' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Solve' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Check' }).click()
  const status = page.getByRole('status')
  await expect(status).toContainText(
    'outer edge pieces are mirror images, so one of these is probably painted the wrong way round',
  )
  await expect(status).toContainText('outlined in pink')

  // Close the message first: the cube moves up into its space, and stays
  // put while the two squares are painted as they really are.
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(status).toHaveCount(0)
  const fix = [...emptyState(PUZZLE_5X5)]
  fix[first] = SCRAMBLED_5X5[first]
  fix[second] = SCRAMBLED_5X5[second]
  await new CubePainter(page, PUZZLE_5X5).paint(fix)
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(status).toContainText(
    'Looks good: this is a real, solvable cube. Solving a 5x5 is coming soon.',
  )
})
