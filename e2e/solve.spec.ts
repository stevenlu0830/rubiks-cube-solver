import { expect, test } from '@playwright/test'
import { CENTER, cellIndex, COLORS } from '../src/cube/state.ts'
import { frontFace, topFace } from '../src/view/orientation.ts'
import { CubePainter } from './cubePainter.ts'
import { SCRAMBLED, TWISTED_CORNER } from './cubes.ts'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
})

test('paints a scrambled cube, checks it, and plays the solution to the end', async ({
  page,
}) => {
  const painter = new CubePainter(page)
  await painter.paint(SCRAMBLED)
  for (const color of COLORS) {
    await expect(
      page.getByRole('button', { name: `${color}, 9/9` }),
    ).toBeVisible()
  }

  await page.getByRole('button', { name: 'Solve' }).click()
  // The holding position is however the cube is turned on screen right now.
  const front = SCRAMBLED[cellIndex(frontFace(painter.orientation), CENTER)]
  const top = SCRAMBLED[cellIndex(topFace(painter.orientation), CENTER)]
  await expect(page.getByLabel('How to hold your cube')).toContainText(
    `Hold your cube with ${front} facing you and ${top} on top`,
    { timeout: 30_000 }, // the solver's one-off setup can take a while
  )
  await page.getByRole('button', { name: "I'm ready" }).click()

  // One turn forward and back, each animated.
  await expect(page.getByText(/^Step 1 of \d+$/)).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText(/^Step 2 of \d+$/)).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByText(/^Step 1 of \d+$/)).toBeVisible()

  // Then the rest by itself, at double speed.
  await page.getByRole('button', { name: /^Speed 1×/ }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Solved 🎉' })).toBeVisible({
    timeout: 60_000,
  })
})

test('explains what is wrong with a cube that cannot be solved', async ({
  page,
}) => {
  await new CubePainter(page).paint(TWISTED_CORNER)
  await page.getByRole('button', { name: 'Solve' }).click()
  await expect(page.getByRole('status')).toContainText('A corner is twisted')
})
