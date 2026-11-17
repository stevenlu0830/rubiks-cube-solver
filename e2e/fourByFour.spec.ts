import { expect, test } from '@playwright/test'
import { PUZZLE_4X4 } from '../src/cube/puzzle.ts'
import { cellIndex, COLORS, emptyState } from '../src/cube/state.ts'
import { CubePainter } from './cubePainter.ts'
import { SCRAMBLED_4X4 } from './cubes.ts'
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

test('has Undo and Reset but no Fill centres, and no Scan or Solve yet', async ({
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
  await expect(
    page.getByRole('button', { name: 'Solving a 4x4 is coming soon' }),
  ).toBeDisabled()
})
