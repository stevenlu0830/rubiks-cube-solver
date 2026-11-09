import { expect, test } from '@playwright/test'
import { Quaternion } from 'three'
import { COLORS } from '../src/cube/state.ts'
import { STICKER_COLORS } from '../src/view/colors.ts'
import type { SwipeDirection } from '../src/view/gestures.ts'
import { frontCells, turnBySwipe } from '../src/view/orientation.ts'
import { CubePainter } from './cubePainter.ts'
import { SCRAMBLED } from './cubes.ts'
import {
  cameraIsOff,
  fakeCamera,
  pictureWidth,
  showSide,
} from './fakeCamera.ts'

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

/** What each instruction asks a person to do with their real cube, as swipes. */
const INSTRUCTIONS: [RegExp, SwipeDirection[]][] = [
  [/^Turn your cube to the left/, ['left']],
  [/^Turn your cube to the right/, ['right']],
  [/^Tip the top of your cube away from you/, ['up']],
  [/^Tip the top of your cube towards you/, ['down']],
  [/^Turn your cube around/, ['left', 'left']],
]

test('scans all six sides of a scrambled cube by following the instructions, then solves it', async ({
  page,
}) => {
  await page.addInitScript(fakeCamera)
  await page.goto('./')
  await page.getByRole('button', { name: 'Scan' }).click()
  await expect.poll(() => pictureWidth(page)).toBe(640)

  // How the person holds their real cube; it starts the same as the 3D one.
  let holding = new Quaternion()
  let quarterTurns = 0
  for (let side = 1; side <= 6; side++) {
    await showSide(
      page,
      frontCells(holding).map((cell) => STICKER_COLORS[SCRAMBLED[cell]!]),
    )
    // Live dots show what a photo would read, before taking it.
    await expect(page.locator('.scan-dots-live .scan-dot')).toHaveCount(9)
    await page.getByRole('button', { name: 'Take photo' }).click()
    await expect(page.getByText(`${side} of 6 sides`)).toBeVisible()
    await expect(page.locator('.scan-dot')).toHaveCount(9)
    if (side === 6) break

    await page.getByRole('button', { name: 'Next side ›' }).click()
    const said = await page.locator('.scan-instruction').textContent()
    const [, swipes] = INSTRUCTIONS.find(([pattern]) => pattern.test(said!))!
    holding = swipes.reduce(turnBySwipe, holding)
    quarterTurns += swipes.length
  }
  expect(quarterTurns).toBe(5)

  await page.getByRole('button', { name: 'Done', exact: true }).click()
  for (const color of COLORS) {
    await expect(
      page.getByRole('button', { name: `${color}, 9/9` }),
    ).toBeVisible()
  }
  const saved = await page.evaluate(() =>
    localStorage.getItem('rubiks-cube-solver/cube'),
  )
  expect(JSON.parse(saved!)).toEqual(SCRAMBLED)

  await page.getByRole('button', { name: 'Solve' }).click()
  await expect(page.getByLabel('How to hold your cube')).toBeVisible({
    timeout: 30_000, // the solver's one-off setup can take a while
  })
})

test('lets you swipe to the sides yourself, and turns the cube around for the last one', async ({
  page,
}) => {
  await page.addInitScript(fakeCamera)
  await page.goto('./')
  await page.getByRole('button', { name: 'Scan' }).click()
  await expect.poll(() => pictureWidth(page)).toBe(640)

  // Swipes the 3D cube like a finger, keeping track of how it's turned;
  // the real cube in front of the camera is turned the same way.
  const cube = new CubePainter(page)
  const photograph = async (count: number) => {
    await showSide(
      page,
      frontCells(cube.orientation).map(
        (cell) => STICKER_COLORS[SCRAMBLED[cell]!],
      ),
    )
    await page.getByRole('button', { name: 'Take photo' }).click()
    await expect(page.getByText(`${count} of 6 sides`)).toBeVisible()
  }
  await photograph(1) // front
  const swipes: SwipeDirection[][] = [
    ['left'], // right
    ['right', 'right'], // left
    ['left', 'down'], // top
    ['up', 'up'], // bottom
  ]
  for (const [i, turns] of swipes.entries()) {
    for (const direction of turns) await cube.swipe(direction)
    await photograph(i + 2)
  }
  await cube.swipe('down') // back to the front: only the back is left

  await page.getByRole('button', { name: 'Next side ›' }).click()
  await expect(page.locator('.scan-instruction')).toHaveText(
    'Turn your cube around, so its back side faces you, then take a photo.',
  )
  cube.orientation = turnBySwipe(turnBySwipe(cube.orientation, 'left'), 'left')
  await photograph(6)

  await page.getByRole('button', { name: 'Done', exact: true }).click()
  const saved = await page.evaluate(() =>
    localStorage.getItem('rubiks-cube-solver/cube'),
  )
  expect(JSON.parse(saved!)).toEqual(SCRAMBLED)
})

test('fixes a square by tapping it on the photo', async ({ page }) => {
  await page.addInitScript(fakeCamera)
  await page.goto('./')
  await page.getByRole('button', { name: 'Scan' }).click()
  await expect.poll(() => pictureWidth(page)).toBe(640)
  const cells = frontCells(new Quaternion())
  await showSide(
    page,
    cells.map((cell) => STICKER_COLORS[SCRAMBLED[cell]!]),
  )
  await page.getByRole('button', { name: 'Take photo' }).click()

  const topLeft = page.getByRole('button', { name: /^top left:/ })
  await expect(topLeft).toHaveAccessibleName(`top left: ${SCRAMBLED[cells[0]]}`)
  await topLeft.click()
  const picker = page.getByRole('group', { name: 'Colour for this square' })
  const other = COLORS.find((color) => color !== SCRAMBLED[cells[0]])!
  await picker.getByRole('button', { name: new RegExp(`^${other},`) }).click()

  await expect(topLeft).toHaveAccessibleName(`top left: ${other}`)
  await expect(picker).toBeHidden()
  const saved = await page.evaluate(() =>
    localStorage.getItem('rubiks-cube-solver/cube'),
  )
  expect(JSON.parse(saved!)[cells[0]]).toBe(other)
})
