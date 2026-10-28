import { expect, test } from '@playwright/test'

// Start the browser with 3D graphics (WebGL) switched off.
test.use({ launchOptions: { args: ['--disable-webgl'] } })

// Skip before the browser starts: Linux WebKit won't even launch with the
// Chromium-only flag above, so a skip inside the test would come too late.
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Only Chromium can turn WebGL off',
)

test('says so when the browser cannot draw 3D', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('alert')).toContainText(
    "This browser can't draw the 3D cube",
  )
  // The rest of the app still works.
  await expect(page.getByRole('button', { name: /^white,/ })).toBeVisible()
})
