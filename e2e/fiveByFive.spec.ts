import { expect, test, type Page } from '@playwright/test'
import { EDGES, wingCellsOf } from '../src/cube/cubies.ts'
import { applyMoves, parseMoves } from '../src/cube/moves.ts'
import { PUZZLE_5X5 } from '../src/cube/puzzle.ts'
import {
  cellIndex,
  centerCell,
  COLORS,
  emptyState,
  FACES,
  isSolved,
  STANDARD_SCHEME,
} from '../src/cube/state.ts'
import { CubePainter } from './cubePainter.ts'
import { savedCube, SCRAMBLED_5X5 } from './cubes.ts'
import { fakeCamera } from './fakeCamera.ts'

const count = (color: string, of: string) => `${color}, ${of}`

/** The 5x5 as saved in the browser. */
const savedFiveByFive = async (page: Page) =>
  JSON.parse(
    (await page.evaluate(() =>
      localStorage.getItem('rubiks-cube-solver/cube-5x5'),
    )) ?? 'null',
  )

test('paints a scrambled 5x5 by tapping and swiping, and keeps it after a reload', async ({
  page,
}) => {
  // 150 taps, each redrawing the cube. On a CI machine, with no graphics
  // chip to draw it, that alone takes over a minute: half again a 4x4's.
  test.slow()
  await page.goto('./#/5x5')
  await expect(
    page.getByRole('heading', { name: '5x5 Cube Solver', level: 1 }),
  ).toBeVisible()

  await new CubePainter(page, PUZZLE_5X5).paint(SCRAMBLED_5X5)
  for (const color of COLORS) {
    await expect(
      page.getByRole('button', { name: count(color, '25/25') }),
    ).toBeVisible()
  }
  // Every one of the 150 squares went where it was tapped.
  expect(await savedFiveByFive(page)).toEqual(SCRAMBLED_5X5)

  await page.reload()
  await expect(
    page.getByRole('button', { name: count('white', '25/25') }),
  ).toBeVisible()

  // The 3x3 has its own cube, still blank.
  await page.getByRole('link', { name: '‹ Cubes' }).click()
  await page.getByRole('link', { name: /^3x3/ }).click()
  await expect(
    page.getByRole('button', { name: count('white', '0/9') }),
  ).toBeVisible()
})

test('fills the six fixed centres, and has Undo and Reset', async ({
  page,
}) => {
  await page.goto('./#/5x5')
  await page.getByRole('button', { name: 'Fill centres' }).click()
  for (const color of COLORS) {
    await expect(
      page.getByRole('button', { name: count(color, '1/25') }),
    ).toBeVisible()
  }
  await expect(
    page.getByRole('button', { name: 'Fill centres' }),
  ).toBeDisabled()
  const filled = [...emptyState(PUZZLE_5X5)]
  for (const face of FACES) {
    filled[centerCell(face, PUZZLE_5X5)] = STANDARD_SCHEME[face]
  }
  expect(await savedFiveByFive(page)).toEqual(filled)

  // Paint one more square after turning the cube round to see the top.
  const oneMore = [...emptyState(PUZZLE_5X5)]
  oneMore[cellIndex('U', 0, PUZZLE_5X5)] = 'red'
  await new CubePainter(page, PUZZLE_5X5).paint(oneMore)
  await expect(
    page.getByRole('button', { name: count('red', '2/25') }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(
    page.getByRole('button', { name: count('red', '1/25') }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(
    page.getByRole('button', { name: count('red', '0/25') }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Fill centres' })).toBeEnabled()
})

test('has Solve but no Scan yet, and outlines a mistake until it is put right', async ({
  page,
}) => {
  // One of the top-front edge's outer pieces painted the wrong way round.
  const [first, second] = wingCellsOf(PUZZLE_5X5)[2 * EDGES.indexOf('UF')]
  const mistake = [...SCRAMBLED_5X5]
  mistake[first] = SCRAMBLED_5X5[second]
  mistake[second] = SCRAMBLED_5X5[first]
  await page.addInitScript(savedCube, mistake)
  // A camera, so the only reason for no Scan button is that it's a 5x5.
  await page.addInitScript(fakeCamera)
  await page.goto('./#/5x5')
  await expect(
    page.getByRole('button', { name: count('white', '25/25') }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Scan' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Check' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Solve' }).click()
  const status = page.getByRole('status')
  await expect(status).toContainText(
    'outer edge pieces are mirror images, so one of these is probably painted the wrong way round',
  )
  await expect(status).toContainText('outlined in pink')

  // Close the message first: the cube moves up into its space, and stays
  // put while the two squares are painted as they really are.
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(status).toHaveCount(0)
  const fix = [...emptyState(PUZZLE_5X5)]
  fix[first] = SCRAMBLED_5X5[first]
  fix[second] = SCRAMBLED_5X5[second]
  await new CubePainter(page, PUZZLE_5X5).paint(fix)
  await page.getByRole('button', { name: 'Solve' }).click()
  await expect(page.getByLabel('How to hold your cube')).toBeVisible({
    timeout: 30_000,
  })
})

test('picks the 5x5, solves a scrambled one, and plays its solution stage by stage to the end, solved', async ({
  page,
}) => {
  // About 130 moves to play, each turning a fifth of the cube's 98 pieces.
  test.setTimeout(240_000)
  // Painted on an earlier visit: painting 150 squares is tested above.
  await page.addInitScript(savedCube, SCRAMBLED_5X5)
  await page.goto('./')
  await page.getByRole('link', { name: /^5x5/ }).click()
  await page.getByRole('button', { name: 'Solve' }).click()

  // The first time, the solver has its tables to build: give it time.
  const hold = page.getByLabel('How to hold your cube')
  await expect(hold).toBeVisible({ timeout: 30_000 })
  await expect(hold).toContainText(
    'Hold your cube with green facing you and white on top.',
  )
  await page.getByRole('button', { name: "I'm ready" }).click()

  // The steps solve it, in at most 170 moves, never turning the whole
  // cube; and they come in stages. This cube needs the parity fix.
  const steps = page.getByRole('list', { name: 'Steps' })
  const moves = parseMoves(
    (await steps.locator('.move-notation').allTextContents()).join(' '),
  )
  expect(moves.length).toBeLessThanOrEqual(170)
  expect(moves.some((move) => /^[xyz]/.test(move))).toBe(false)
  expect(isSolved(applyMoves(SCRAMBLED_5X5, moves))).toBe(true)
  expect(await steps.getByRole('heading').allTextContents()).toEqual([
    'Centres',
    'Pair the edges',
    'Parity fix',
    'Finish like a 3x3',
  ])
  await expect(page.getByText(/^Step 1 of \d+ · Centres$/)).toBeVisible()

  const play = page.getByRole('button', { name: 'Play', exact: true })
  const pause = page.getByRole('button', { name: 'Pause', exact: true })
  /** Presses Play and waits until it stops by itself, at a checkpoint or the end. */
  const playStage = async () => {
    await play.click()
    await expect(pause).toBeVisible()
    await expect(play).toBeVisible({ timeout: 90_000 })
  }
  const checkpoint = page.locator('.solve-card-checkpoint')

  // Play the centres at double speed: it stops after them for a check.
  await page.getByRole('button', { name: /^Speed 1×/ }).click()
  await playStage()
  await expect(checkpoint).toContainText(
    "Centres done. Each centre should now be one colour: white on top, green in front. They won't move from here.",
  )
  await expect(
    page.getByText(/^Step \d+ of \d+ · Pair the edges$/),
  ).toBeVisible()

  // Skip to the last move of the edges: it stops after it, before the
  // parity fix, and says which edge that's for.
  await steps
    .getByRole('list', { name: 'Pair the edges' })
    .getByRole('button')
    .last()
    .click()
  await playStage()
  await expect(checkpoint).toContainText(
    "Pair the edges done. Each edge's three pieces should now match, in a row, and the centres still be whole.",
  )
  await expect(checkpoint).toContainText(
    /All but the edge between the \w+ and the \w+: its two outer pieces show their colours the other way round from its middle one\./,
  )

  // Play the parity fix and the finish right through, to the end.
  await playStage()
  await expect(checkpoint).toContainText(
    'Parity fix done. Every edge should now match all the way along, and the centres still be whole.',
  )
  await playStage()
  await expect(page.getByRole('heading', { name: 'Solved 🎉' })).toBeVisible()
  await expect(page.getByText(`That's all ${moves.length} moves`)).toBeVisible()

  // The 5x5's own solver ran, and not another cube's.
  const workers = page.workers().map((worker) => worker.url())
  expect(workers.some((url) => url.includes('fiveByFive.worker'))).toBe(true)
  expect(
    workers.some((url) => /(solver|fourByFour|twoByTwo)\.worker/.test(url)),
  ).toBe(false)
})
