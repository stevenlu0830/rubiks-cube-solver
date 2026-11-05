import { expect, test } from '@playwright/test'
import { cameraIsOff, fakeCamera, pictureWidth } from './fakeCamera.ts'

test('shows the camera with a guide, and switches it off with Done', async ({
  page,
}) => {
  await page.addInitScript(fakeCamera)
  await page.goto('./')
  await page.getByRole('button', { name: 'Scan' }).click()

  const scanner = page.getByRole('region', { name: 'Scan your cube' })
  await expect(scanner).toBeVisible()
  // The camera's pictures arrive, and play inside the page.
  await expect.poll(() => pictureWidth(page)).toBe(640)
  await expect(page.locator('.scan-guide')).toBeVisible()
  // The cube is still there below, to be turned.
  await expect(page.locator('canvas')).toBeVisible()

  await page.getByRole('button', { name: '‹ Done' }).click()
  await expect(scanner).toBeHidden()
  expect(await cameraIsOff(page)).toBe(true)
  await expect(page.getByRole('button', { name: /^white,/ })).toBeVisible()
})

test('explains when the camera is blocked, and tries again', async ({
  page,
}) => {
  await page.addInitScript(fakeCamera, { refuseFirst: true })
  await page.goto('./')
  await page.getByRole('button', { name: 'Scan' }).click()
  await expect(page.getByRole('alert')).toContainText('The camera is blocked')

  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('alert')).toBeHidden()
  await expect.poll(() => pictureWidth(page)).toBe(640)
})
