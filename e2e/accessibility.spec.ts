import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { solvedState } from '../src/cube/state.ts'
import { savedCube, SCRAMBLED } from './cubes.ts'

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

    test('the painting screen, its messages and the settings menu', async ({
      page,
    }) => {
      await page.goto('./')
      await expectNoProblems(page)
      await page.getByRole('button', { name: 'Solve' }).click() // a problem: all blank
      await expectNoProblems(page)
      await page.getByRole('button', { name: 'Settings' }).click()
      await expectNoProblems(page)
    })

    test('the "already solved" message', async ({ page }) => {
      await page.addInitScript(savedCube, solvedState())
      await page.goto('./')
      await page.getByRole('button', { name: 'Solve' }).click()
      await expect(page.getByRole('status')).toContainText('already solved')
      await expectNoProblems(page)
    })

    test('the solve screen, from holding the cube to Solved', async ({
      page,
    }) => {
      await page.addInitScript(savedCube, SCRAMBLED)
      await page.goto('./')
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
