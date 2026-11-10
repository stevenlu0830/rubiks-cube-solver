import { expect, test } from '@playwright/test'
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

test('shows the 2x2 as coming soon, and #/2x2 opens the picker', async ({
  page,
}) => {
  await page.goto('./#/2x2')
  await expect(page.getByRole('heading', pickerTitle)).toBeVisible()
  const twoByTwo = page.getByRole('listitem').filter({ hasText: '2x2' })
  await expect(twoByTwo).toContainText('Coming soon')
  await expect(twoByTwo.getByRole('link')).toHaveCount(0)
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
