import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { applyMoves, parseMoves } from '../src/cube/moves.ts'
import { Quaternion } from 'three'
import { PUZZLE_2X2, PUZZLE_4X4, PUZZLE_5X5 } from '../src/cube/puzzle.ts'
import { solvedState, STANDARD_SCHEME } from '../src/cube/state.ts'
import { STICKER_COLORS } from '../src/view/colors.ts'
import { frontCells } from '../src/view/orientation.ts'
import {
  savedCube,
  SCRAMBLED,
  SCRAMBLED_2X2,
  SCRAMBLED_4X4,
  SCRAMBLED_5X5,
} from './cubes.ts'
import { fakeCamera, scanEverySide, showSide } from './fakeCamera.ts'

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

    test('the page for picking a cube, and its About window', async ({
      page,
    }) => {
      // A saved cube of each, so every card shows "In progress" too.
      await page.addInitScript(savedCube, SCRAMBLED)
      await page.addInitScript(savedCube, SCRAMBLED_2X2)
      await page.addInitScript(savedCube, SCRAMBLED_4X4)
      await page.addInitScript(savedCube, SCRAMBLED_5X5)
      await page.goto('./')
      await expect(page.getByText('In progress')).toHaveCount(4)
      await expectNoProblems(page)
      await page.getByRole('button', { name: 'About this app' }).click()
      await expect(page.getByRole('dialog', { name: 'About' })).toBeVisible()
      await expectNoProblems(page)
    })

    test('the 2x2 painting screen, its messages, the settings menu and the About window', async ({
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
      await page.getByRole('button', { name: 'Settings' }).click()
      await expectNoProblems(page)
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'About this app' }).click()
      await expect(page.getByRole('dialog', { name: 'About' })).toBeVisible()
      await expectNoProblems(page)
    })

    test('the 4x4 painting screen, its messages, the settings menu and the About window', async ({
      page,
    }) => {
      await page.goto('./#/4x4')
      await expect(
        page.getByRole('button', { name: 'white, 0/16' }),
      ).toBeVisible()
      await expectNoProblems(page)
      await page.getByRole('button', { name: 'Solve' }).click() // all blank
      await expect(page.getByRole('status')).toContainText('still blank')
      await expectNoProblems(page)
      await page.getByRole('button', { name: 'Settings' }).click()
      await expectNoProblems(page)
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'About this app' }).click()
      await expect(page.getByRole('dialog', { name: 'About' })).toBeVisible()
      await expectNoProblems(page)
    })

    test('the 5x5 painting screen, its messages, the settings menu and the About window', async ({
      page,
    }) => {
      await page.goto('./#/5x5')
      await expect(
        page.getByRole('button', { name: 'white, 0/25' }),
      ).toBeVisible()
      await expectNoProblems(page)
      await page.getByRole('button', { name: 'Fill centres' }).click()
      await expect(
        page.getByRole('button', { name: 'white, 1/25' }),
      ).toBeVisible()
      await expectNoProblems(page)
      await page.getByRole('button', { name: 'Solve' }).click() // mostly blank
      await expect(page.getByRole('status')).toContainText('still blank')
      await expectNoProblems(page)
      await page.getByRole('button', { name: 'Settings' }).click()
      await expectNoProblems(page)
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'About this app' }).click()
      await expect(page.getByRole('dialog', { name: 'About' })).toBeVisible()
      await expectNoProblems(page)
    })

    test('the 5x5 solve screen: holding the cube, a step, the checkpoint before a parity fix, and Solved', async ({
      page,
    }) => {
      await page.addInitScript(savedCube, SCRAMBLED_5X5)
      await page.goto('./#/5x5')
      await page.getByRole('button', { name: 'Solve' }).click()
      await expect(page.getByLabel('How to hold your cube')).toBeVisible({
        timeout: 30_000,
      })
      await expectNoProblems(page)
      await page.getByRole('button', { name: "I'm ready" }).click()
      await expect(page.getByText(/^Step 1 of \d+ · Centres$/)).toBeVisible()
      await expectNoProblems(page) // a step, with the 5x5's map

      // The first step of the parity fix: the edges' checkpoint, which
      // says which edge the fix is for.
      await page
        .getByRole('list', { name: 'Parity fix' })
        .getByRole('button')
        .first()
        .click()
      await expect(page.getByText(/All but the edge between/)).toBeVisible()
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

    test('the 4x4 "already solved" message', async ({ page }) => {
      await page.addInitScript(
        savedCube,
        solvedState(STANDARD_SCHEME, PUZZLE_4X4),
      )
      await page.goto('./#/4x4')
      await page.getByRole('button', { name: 'Solve' }).click()
      await expect(page.getByRole('status')).toContainText('already solved')
      await expectNoProblems(page)
    })

    test('the 4x4 solve screen: holding the cube, a step, a checkpoint and Solved', async ({
      page,
    }) => {
      await page.addInitScript(savedCube, SCRAMBLED_4X4)
      await page.goto('./#/4x4')
      await page.getByRole('button', { name: 'Solve' }).click()
      await expect(page.getByLabel('How to hold your cube')).toBeVisible({
        timeout: 30_000,
      })
      await expectNoProblems(page)
      await page.getByRole('button', { name: "I'm ready" }).click()
      await expect(page.getByText(/^Step 1 of \d+ · Centres$/)).toBeVisible()
      await expectNoProblems(page) // a step, with the stages in the step list

      // The first step of the next stage: the centres' checkpoint.
      const edges = page
        .getByRole('list', { name: 'Pair the edges' })
        .getByRole('button')
      await edges.first().click()
      await expect(page.getByText(/^Centres done\./).first()).toBeVisible()
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

    test('the 2x2 "already solved" message', async ({ page }) => {
      await page.addInitScript(
        savedCube,
        solvedState(STANDARD_SCHEME, PUZZLE_2X2),
      )
      await page.goto('./#/2x2')
      await page.getByRole('button', { name: 'Solve' }).click()
      await expect(page.getByRole('status')).toContainText('already solved')
      await expectNoProblems(page)
    })

    test('the 2x2 solve screen, from holding the cube to Solved', async ({
      page,
    }) => {
      await page.addInitScript(
        savedCube,
        applyMoves(
          solvedState(STANDARD_SCHEME, PUZZLE_2X2),
          parseMoves("R U2 F' R"),
        ),
      )
      await page.goto('./#/2x2')
      await page.getByRole('button', { name: 'Solve' }).click()
      await expect(page.getByLabel('How to hold your cube')).toContainText(
        'the corner at the back, bottom left',
      )
      await expectNoProblems(page)
      await page.getByRole('button', { name: "I'm ready" }).click()
      await expect(page.getByText(/^Step 1 of \d+$/)).toBeVisible()
      await expectNoProblems(page) // a step, with the 2x2's map

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

    test('the 2x2 scan screen, a photo, a side scanned twice, and fixing a square', async ({
      page,
    }) => {
      await page.addInitScript(fakeCamera)
      await page.goto('./#/2x2')
      await page.getByRole('button', { name: 'Scan' }).click()
      await expect(page.locator('.scan-guide > span')).toHaveCount(4)
      await expectNoProblems(page)
      await showSide(
        page,
        (['red', 'green', 'orange', 'white'] as const).map(
          (color) => STICKER_COLORS[color],
        ),
      )
      await expect(page.getByText('1 of 6 sides')).toBeVisible() // Auto photo
      await expect(page.locator('.scan-dot')).toHaveCount(4)
      await expectNoProblems(page)

      // The same side again: a warning.
      await page.getByRole('button', { name: 'Next side ›' }).click()
      await page.getByRole('button', { name: 'Take photo' }).click()
      await expect(page.locator('.scan-instruction')).toContainText(
        "which you've already scanned",
      )
      await expectNoProblems(page)

      await page.getByRole('button', { name: /^top left:/ }).click()
      await expect(
        page.getByRole('group', { name: 'Colour for this square' }),
      ).toBeVisible()
      await expectNoProblems(page)
    })

    test('the 4x4 scan screen, a photo, and fixing a square', async ({
      page,
    }) => {
      await page.addInitScript(fakeCamera)
      await page.goto('./#/4x4')
      await page.getByRole('button', { name: 'Scan' }).click()
      await expect(page.locator('.scan-guide > span')).toHaveCount(16)
      await expectNoProblems(page)
      await showSide(
        page,
        frontCells(new Quaternion(), PUZZLE_4X4).map(
          (cell) => STICKER_COLORS[SCRAMBLED_4X4[cell]!],
        ),
      )
      await expect(page.getByText('1 of 6 sides')).toBeVisible() // Auto photo
      await expect(page.locator('.scan-dot')).toHaveCount(16)
      await expectNoProblems(page)

      await page.getByRole('button', { name: /^row 2, column 3:/ }).click()
      await expect(
        page.getByText('Pick the colour of the square in row 2, column 3:'),
      ).toBeVisible()
      await expectNoProblems(page)
    })

    test('the 5x5 scan screen, a photo, and fixing a square', async ({
      page,
    }) => {
      await page.addInitScript(fakeCamera)
      await page.goto('./#/5x5')
      await page.getByRole('button', { name: 'Scan' }).click()
      await expect(page.locator('.scan-guide > span')).toHaveCount(25)
      await expectNoProblems(page)
      await showSide(
        page,
        frontCells(new Quaternion(), PUZZLE_5X5).map(
          (cell) => STICKER_COLORS[SCRAMBLED_5X5[cell]!],
        ),
      )
      await expect(page.getByText('1 of 6 sides')).toBeVisible() // Auto photo
      await expect(page.locator('.scan-dot')).toHaveCount(25)
      await expectNoProblems(page)

      await page.getByRole('button', { name: /^row 3, column 3:/ }).click()
      await expect(
        page.getByText('Pick the colour of the square in row 3, column 3:'),
      ).toBeVisible()
      await expectNoProblems(page)
    })

    test('a 2x2 side held turned, and its Fix it button', async ({ page }) => {
      await page.addInitScript(fakeCamera)
      await page.goto('./#/2x2')
      await page.getByRole('button', { name: 'Scan' }).click()
      await scanEverySide(page, SCRAMBLED_2X2, { firstSideTurned: 1 })
      await expect(page.locator('.scan-instruction')).toContainText(
        /The \w+ side looks turned\. Fix it\?/,
      )
      await expect(page.getByRole('button', { name: 'Fix it' })).toBeVisible()
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
