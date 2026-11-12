import { expect, test } from '@playwright/test'
import { PUZZLE_2X2 } from '../src/cube/puzzle.ts'
import { cellIndex, emptyState } from '../src/cube/state.ts'
import { CubePainter } from './cubePainter.ts'
import { savedCube, SCRAMBLED } from './cubes.ts'

const pickerTitle = { name: "Rubik's Cube Solver", level: 1 }
const solverTitle = { name: '3x3 Cube Solver', level: 1 }

test('opens on the picker, goes to the 3x3 and back, and the Back button works', async ({
  page,
}) => {
  await page.goto('./')
  await expect(page.getByRole('heading', pickerTitle)).toBeVisible()
  await expect(page).toHaveTitle("Rubik's Cube Solver")

  await page.getByRole('link', { name: /^3x3/ }).click()
  await expect(page).toHaveURL(/#\/3x3$/)
  await expect(page).toHaveTitle("3x3 · Rubik's Cube Solver")
  await expect(page.getByRole('heading', solverTitle)).toBeVisible()
  await expect(page.getByRole('button', { name: /^white,/ })).toBeVisible()

  await page.getByRole('link', { name: '‹ Cubes' }).click()
  await expect(page.getByRole('heading', pickerTitle)).toBeVisible()

  // The browser's (or phone's) Back button returns to the cube.
  await page.goBack()
  await expect(page.getByRole('heading', solverTitle)).toBeVisible()
})

test('goes to the 2x2 too, and says when one is in progress', async ({
  page,
}) => {
  await page.goto('./')
  const twoByTwo = page.getByRole('listitem').filter({ hasText: '2x2' })
  await expect(twoByTwo).not.toContainText('Coming soon')
  await expect(twoByTwo).not.toContainText('In progress')

  await twoByTwo.getByRole('link').click()
  await expect(page).toHaveURL(/#\/2x2$/)
  await expect(page).toHaveTitle("2x2 · Rubik's Cube Solver")
  await expect(
    page.getByRole('heading', { name: '2x2 Cube Solver', level: 1 }),
  ).toBeVisible()

  // Paint one square, then go back: the 2x2 is now in progress.
  const oneSquare = [...emptyState(PUZZLE_2X2)]
  oneSquare[cellIndex('F', 0, PUZZLE_2X2)] = 'red'
  await new CubePainter(page, PUZZLE_2X2).paint(oneSquare)
  await expect(page.getByRole('button', { name: 'red, 1/4' })).toBeVisible()
  await page.getByRole('link', { name: '‹ Cubes' }).click()
  await expect(twoByTwo).toContainText('In progress')
})

test('keeps a cube painted on an earlier visit, and says so on the picker', async ({
  page,
}) => {
  await page.addInitScript(savedCube, SCRAMBLED)
  await page.goto('./')
  const threeByThree = page.getByRole('listitem').filter({ hasText: '3x3' })
  await expect(threeByThree).toContainText('In progress')

  await threeByThree.getByRole('link').click()
  // All 54 squares are still painted: 9 of each colour.
  await expect(page.getByRole('button', { name: 'white, 9/9' })).toBeVisible()
})
