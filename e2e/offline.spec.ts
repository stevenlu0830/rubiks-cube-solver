import { expect, test } from '@playwright/test'
import { savedCube, SCRAMBLED } from './cubes.ts'

test('opens and solves with no internet after the first visit', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Only Chromium can pretend to be offline with a service worker',
  )
  await page.addInitScript(savedCube, SCRAMBLED)
  await page.goto('./')
  // Wait for the service worker to finish saving the app's files.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })

  await context.setOffline(true)
  await page.reload()
  await page.getByRole('button', { name: 'Solve' }).click()
  await expect(page.getByLabel('How to hold your cube')).toBeVisible({
    timeout: 30_000,
  })
})
