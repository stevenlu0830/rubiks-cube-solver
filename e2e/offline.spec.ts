import { expect, test } from '@playwright/test'
import type { CubeType } from '../src/cube/puzzle.ts'
import type { CubeState } from '../src/cube/state.ts'
import {
  savedCube,
  SCRAMBLED,
  SCRAMBLED_2X2,
  SCRAMBLED_4X4,
  SCRAMBLED_5X5,
} from './cubes.ts'

const CUBES: [CubeType, CubeState][] = [
  ['3x3', SCRAMBLED],
  ['2x2', SCRAMBLED_2X2],
  ['4x4', SCRAMBLED_4X4],
  ['5x5', SCRAMBLED_5X5],
]

/** The start of each cube's solver worker's file name, before its fingerprint. */
const WORKER_FILES: Record<CubeType, string> = {
  '3x3': '/solver.worker-',
  '2x2': '/twoByTwo.worker-',
  '4x4': '/fourByFour.worker-',
  '5x5': '/fiveByFive.worker-',
}

for (const [cube, scrambled] of CUBES) {
  test(`opens and solves a ${cube} with no internet after the first visit`, async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'Only Chromium can pretend to be offline with a service worker',
    )
    await page.addInitScript(savedCube, scrambled)
    // Only the first page: the cube's page and its solver aren't opened
    // until offline, so they must have been saved along with it.
    await page.goto('./')
    // Wait for the service worker to finish saving the app's files.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })

    await context.setOffline(true)
    await page.reload()
    await page.getByRole('link', { name: new RegExp(`^${cube}`) }).click()
    await page.getByRole('button', { name: 'Solve' }).click()
    await expect(page.getByLabel('How to hold your cube')).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole('button', { name: "I'm ready" }).click()
    // A 4x4's or 5x5's steps also say their stage: "Step 1 of 73 · Centres".
    await expect(page.getByText(/^Step 1 of \d+( · Centres)?$/)).toBeVisible()
    // The solver ran in its own worker, from the saved copy of its file.
    const workers = page.workers().map((worker) => worker.url())
    expect(workers.some((url) => url.includes(WORKER_FILES[cube]))).toBe(true)
  })
}

test("opens the 2x2's, 4x4's and 5x5's pages with no internet, after only visiting the 3x3's", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Only Chromium can pretend to be offline with a service worker',
  )
  await page.goto('./#/3x3')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })

  await context.setOffline(true)
  await page.goto('./#/2x2')
  await page.reload()
  await expect(
    page.getByRole('heading', { name: '2x2 Cube Solver', level: 1 }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'white, 0/4' })).toBeVisible()

  await page.goto('./#/4x4')
  await page.reload()
  await expect(
    page.getByRole('heading', { name: '4x4 Cube Solver', level: 1 }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'white, 0/16' })).toBeVisible()

  await page.goto('./#/5x5')
  await page.reload()
  await expect(
    page.getByRole('heading', { name: '5x5 Cube Solver', level: 1 }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'white, 0/25' })).toBeVisible()
})
