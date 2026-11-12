import type { Page } from '@playwright/test'
import { shownPart, type Rect } from '../src/scan/viewfinder.ts'

/**
 * Runs in the page before it loads: swaps the camera for a drawing, so
 * tests can scan without one. Chromium has its own fake camera, but it's
 * switched on with a Chromium-only flag; this works the same in WebKit too.
 * With `refuseFirst`, the first request is refused, as if the user said no.
 * `facing` is which way the camera says it faces: a phone's back camera,
 * or one facing the user, like a laptop's.
 */
export function fakeCamera({
  refuseFirst = false,
  facing = 'environment',
}: { refuseFirst?: boolean; facing?: 'environment' | 'user' } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  const context = canvas.getContext('2d')!
  /** A side of a cube to show, if any: where in the picture, and its colours (9, or 4 for a 2x2). */
  let side: { area: Rect; colors: string[] } | null = null
  const draw = () => {
    // Until a side is shown: a plain wall, which Auto photo won't take.
    context.fillStyle = '#777'
    context.fillRect(0, 0, 640, 480)
    if (!side) return
    // Black plastic, with a sticker in each square.
    const { area, colors } = side
    const across = Math.round(Math.sqrt(colors.length)) // squares each way
    const size = area.width / across
    context.fillStyle = '#111'
    context.fillRect(area.x, area.y, area.width, area.height)
    colors.forEach((color, n) => {
      context.fillStyle = color
      context.fillRect(
        area.x + (n % across) * size + size * 0.08,
        area.y + Math.floor(n / across) * size + size * 0.08,
        size * 0.84,
        size * 0.84,
      )
    })
  }
  draw()
  // A canvas only sends a new picture when it's drawn on, so keep drawing.
  setInterval(draw, 100)

  let refusals = refuseFirst ? 1 : 0
  const streams: MediaStream[] = []
  Object.assign(window, {
    fakeCameraStreams: streams,
    showFakeSide: (area: Rect, colors: string[]) => {
      side = { area, colors }
      draw()
    },
  })
  // On the prototype, not navigator.mediaDevices itself: WebKit swaps that
  // object for a new one after this script has run.
  MediaDevices.prototype.getUserMedia = async () => {
    if (refusals-- > 0) throw new DOMException('No', 'NotAllowedError')
    const stream = canvas.captureStream()
    for (const track of stream.getVideoTracks()) {
      const settings = track.getSettings.bind(track)
      track.getSettings = () => ({ ...settings(), facingMode: facing })
    }
    streams.push(stream)
    return stream
  }
}

/** True once every stream the fake camera handed out has been switched off. */
export function cameraIsOff(page: Page) {
  return page.evaluate(() =>
    (
      window as unknown as { fakeCameraStreams: MediaStream[] }
    ).fakeCameraStreams
      .flatMap((stream) => stream.getTracks())
      .every((track) => track.readyState === 'ended'),
  )
}

/** How wide the pictures showing in the viewfinder are: 0 until they arrive. */
export function pictureWidth(page: Page) {
  return page
    .locator('video')
    .evaluate((video: HTMLVideoElement) => video.videoWidth)
}

/**
 * Holds a side of a cube in these colours (CSS colours, row by row from the
 * top left: 9 for a 3x3, 4 for a 2x2) up to the fake camera, lined up with
 * the guide on screen.
 */
export async function showSide(page: Page, colors: string[]) {
  const [video, guide] = await Promise.all([
    page.locator('video').boundingBox(),
    page.locator('.scan-guide').boundingBox(),
  ])
  if (!video || !guide) throw new Error('The camera is not on screen')
  const area = shownPart(
    {
      x: guide.x - video.x,
      y: guide.y - video.y,
      width: guide.width,
      height: guide.height,
    },
    video,
    { width: 640, height: 480 },
  )
  await page.evaluate(
    ([area, colors]) =>
      (
        window as unknown as {
          showFakeSide: (area: Rect, colors: string[]) => void
        }
      ).showFakeSide(area, colors),
    [area, colors] as const,
  )
  // Wait for the camera's picture to catch up: the middle of every square
  // shows its colour.
  await page.waitForFunction(
    ([area, colors]) => {
      const video = document.querySelector('video')!
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const context = canvas.getContext('2d')!
      const across = Math.round(Math.sqrt(colors.length))
      const size = area.width / across
      return colors.every((color, n) => {
        const x = area.x + ((n % across) + 0.5) * size
        const y = area.y + (Math.floor(n / across) + 0.5) * size
        context.drawImage(video, x, y, 1, 1, 0, 0, 1, 1)
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data
        context.fillStyle = color
        context.fillRect(0, 0, 1, 1)
        const [er, eg, eb] = context.getImageData(0, 0, 1, 1).data
        return Math.abs(r - er) + Math.abs(g - eg) + Math.abs(b - eb) < 30
      })
    },
    [area, colors] as const,
  )
}
