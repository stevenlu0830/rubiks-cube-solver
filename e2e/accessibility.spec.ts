import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { applyMoves, parseMoves } from '../src/cube/moves.ts'
import { PUZZLE_2X2 } from '../src/cube/puzzle.ts'
import { solvedState, STANDARD_SCHEME } from '../src/cube/state.ts'
import { savedCube, SCRAMBLED } from './cubes.ts'
import { fakeCamera } from './fakeCamera.ts'

/**
 * Automatic accessibility checks (axe), including text contrast, on every
 * screen, in light and dark mode. They can't catch everything: a person
 * still has to try the app with a screen reader, for example.
 */

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectNoProblems(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_AA)
    .analyze()
  const problems = violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${violation.id}: ${node.target.join(' ')} (${node.failureSummary})`,
    ),
  )
  expect(problems).toEqual([])
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme })

    test('the page for picking a cube', async ({ page }) => {
      // A saved cube, so the 3x3 card shows "In progress" too.
      await page.addInitScript(savedCube, SCRAMBLED)
      await page.goto('./')
      await expect(page.getByText('In progress')).toBeVisible()
      await expectNoProblems(page)
    })

    test('the 2x2 painting screen, a problem, and its solve screen', async ({
      page,
    }) => {
      await page.goto('./#/2x2')
      await expect(
        page.getByRole('button', { name: 'white, 0/4' }),
      ).toBeVisible()
      await expectNoProblems(page)
      await page.getByRole('button', { name: 'Solve' }).click() // all blank
      await expect(page.getByRole('status')).toContainText('still blank')
      await expectNoProblems(page)

      await page.evaluate(
        (cube) =>
          localStorage.setItem(
            'rubiks-cube-solver/cube-2x2',
            JSON.stringify(cube),
          ),
        applyMoves(
          solvedState(STANDARD_SCHEME, PUZZLE_2X2),
          parseMoves("R U2 F' R"),
        ),
      )
      await page.reload()
      await page.getByRole('button', { name: 'Solve' }).click()
      await expect(page.getByLabel('How to hold your cube')).toContainText(
        'the corner at the back, bottom left',
      )
      await expectNoProblems(page)
      await page.getByRole('button', { name: "I'm ready" }).click()
      await expect(page.getByText(/^Step 1 of \d+$/)).toBeVisible()
      await expectNoProblems(page) // a step, with the 2x2's map
    })

    test('the painting screen, its messages, the settings menu and the About window', async ({
      page,
    }) => {
      await page.goto('./#/3x3')
      await expectNoProblems(page)
      await page.getByRole('button', { name: 'Solve' }).click() // a problem: all blank
      await expectNoProblems(page)
      await page.getByRole('button', { name: 'Settings' }).click()
      await expectNoProblems(page)
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'About this app' }).click()
      await expect(page.getByRole('dialog', { name: 'About' })).toBeVisible()
      await expectNoProblems(page)
    })

    test('the scan screen, its message when the camera is blocked, a photo, and fixing a square', async ({
      page,
    }) => {
      await page.addInitScript(fakeCamera, { refuseFirst: true })
      await page.goto('./#/3x3')
      await page.getByRole('button', { name: 'Scan' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
      await expectNoProblems(page)

      await page.getByRole('button', { name: 'Try again' }).click()
      await expect(page.locator('.scan-guide')).toBeVisible()
      await expectNoProblems(page)

      await page.getByRole('button', { name: 'Take photo' }).click()
      await expect(page.locator('.scan-dot')).toHaveCount(9)
      await expectNoProblems(page)

      await page.getByRole('button', { name: /^centre:/ }).click()
      await expect(
        page.getByRole('group', { name: 'Colour for this square' }),
      ).toBeVisible()
      await expectNoProblems(page)
    })

    test('the "already solved" message', async ({ page }) => {
      await page.addInitScript(savedCube, solvedState())
      await page.goto('./#/3x3')
      await page.getByRole('button', { name: 'Solve' }).click()
      await expect(page.getByRole('status')).toContainText('already solved')
      await expectNoProblems(page)
    })

    test('the solve screen, from holding the cube to Solved', async ({
      page,
    }) => {
      await page.addInitScript(savedCube, SCRAMBLED)
      await page.goto('./#/3x3')
      await page.getByRole('button', { name: 'Solve' }).click()
      await expect(page.getByLabel('How to hold your cube')).toBeVisible({
        timeout: 30_000,
      })
      await expectNoProblems(page)

      await page.getByRole('button', { name: "I'm ready" }).click()
      await expectNoProblems(page)

      const steps = page
        .getByRole('list', { name: 'Steps' })
        .getByRole('button')
      await steps.last().click()
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await expect(
        page.getByRole('heading', { name: 'Solved 🎉' }),
      ).toBeVisible()
      await expectNoProblems(page)
    })
  })
}
