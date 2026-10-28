import { expect, test } from '@playwright/test'

// Start the browser with 3D graphics (WebGL) switched off.
test.use({ launchOptions: { args: ['--disable-webgl'] } })

test('says so when the browser cannot draw 3D', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Only Chromium can turn WebGL off')
  await page.goto('./')
  await expect(page.getByRole('alert')).toContainText(
    "This browser can't draw the 3D cube",
  )
  // The rest of the app still works.
  await expect(page.getByRole('button', { name: /^white,/ })).toBeVisible()
})
