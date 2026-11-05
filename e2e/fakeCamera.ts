import type { Page } from '@playwright/test'

/**
 * Runs in the page before it loads: swaps the camera for a drawing, so
 * tests can scan without one. Chromium has its own fake camera, but it's
 * switched on with a Chromium-only flag; this works the same in WebKit too.
 * With `refuseFirst`, the first request is refused, as if the user said no.
 */
export function fakeCamera({ refuseFirst = false } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  const context = canvas.getContext('2d')!
  const draw = () => {
    context.fillStyle = '#333'
    context.fillRect(0, 0, 640, 480)
    context.fillStyle = '#009b48'
    context.fillRect(200, 120, 240, 240)
  }
  draw()
  // A canvas only sends a new picture when it's drawn on, so keep drawing.
  setInterval(draw, 100)

  let refusals = refuseFirst ? 1 : 0
  const streams: MediaStream[] = []
  Object.assign(window, { fakeCameraStreams: streams })
  // On the prototype, not navigator.mediaDevices itself: WebKit swaps that
  // object for a new one after this script has run.
  MediaDevices.prototype.getUserMedia = async () => {
    if (refusals-- > 0) throw new DOMException('No', 'NotAllowedError')
    const stream = canvas.captureStream()
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
