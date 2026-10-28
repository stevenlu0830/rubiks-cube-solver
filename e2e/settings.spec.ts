import { expect, test } from '@playwright/test'

test('turns on colour letters from the settings menu, and remembers them', async ({
  page,
}) => {
  await page.goto('./')
  const letters = page.getByRole('checkbox', { name: /^Letters on stickers/ })
  const green = page.getByRole('button', { name: /^green,/ })
  await expect(letters).toBeHidden()

  await page.getByRole('button', { name: 'Settings' }).click()
  await letters.check()
  await expect(green).toContainText('G')

  // Tapping anywhere else closes the menu.
  await page.getByRole('heading', { name: "Rubik's Cube Solver" }).click()
  await expect(letters).toBeHidden()

  await page.reload()
  await expect(green).toContainText('G')
})

test('offers vibration only where the phone can vibrate', async ({
  page,
  browserName,
}) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Settings' }).click()
  const vibration = page.getByRole('checkbox', { name: /^Vibration/ })
  if (browserName === 'webkit') {
    await expect(vibration).toHaveCount(0) // Safari on iPhone can't
  } else {
    await expect(vibration).toBeChecked()
  }
})
