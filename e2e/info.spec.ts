import { expect, test } from '@playwright/test'

test('the ⓘ button opens a window about the app in the middle of the screen', async ({
  page,
}) => {
  await page.goto('./')
  const about = page.getByRole('dialog', { name: 'About' })
  await expect(about).toBeHidden()

  await page.getByRole('button', { name: 'About this app' }).click()
  await expect(about).toBeVisible()
  await expect(about).toContainText("a 2x2 or 3x3 Rubik's Cube")
  await expect(about).toContainText('scan it with your camera')
  await expect(about.getByRole('listitem').first()).toBeVisible() // tech stack
  for (const name of ['GitHub', 'LinkedIn', 'Email', 'Personal Profile']) {
    await expect(about).toContainText(name)
  }

  // Centred: the same gap on the left as the right, and above as below.
  const box = (await about.boundingBox())!
  const screen = page.viewportSize()!
  expect(box.x).toBeCloseTo(screen.width - box.x - box.width, 0)
  expect(box.y).toBeCloseTo(screen.height - box.y - box.height, 0)
})

test('the About window closes with its × button, or by tapping outside it', async ({
  page,
}) => {
  await page.goto('./')
  const open = page.getByRole('button', { name: 'About this app' })
  const about = page.getByRole('dialog', { name: 'About' })

  await open.click()
  await about.getByRole('button', { name: 'Close' }).click()
  await expect(about).toBeHidden()

  await open.click()
  await expect(about).toBeVisible()
  const box = (await about.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height + 40)
  await expect(about).toBeHidden()
})
