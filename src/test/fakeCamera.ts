import { vi, type Mock } from 'vitest'
import type { Color } from '../cube/state.ts'
import { GRAB_SIZE, type Pixels } from '../scan/sample.ts'
import { STICKER_COLORS } from '../view/colors.ts'

/** A stream handed out by the fake camera. */
export interface FakeStream {
  stream: MediaStream
  /** Its one video track. Dispatch an 'ended' event on it to cut the camera off. */
  track: EventTarget & { stop: Mock<() => void> }
}

/**
 * Pretends the browser can use a camera, which the test environment can't.
 * Every stream it hands out is kept in `opened`, so tests can check it was
 * switched off. Make it refuse with e.g.
 * `getUserMedia.mockRejectedValueOnce(new DOMException('', 'NotAllowedError'))`.
 *
 * The test environment can't play video or draw it on a canvas either, so
 * those are faked too: `show` sets the 9 colours a photo will read.
 */
export function fakeCamera() {
  const opened: FakeStream[] = []
  const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
    void constraints
    const track = Object.assign(new EventTarget(), { stop: vi.fn() })
    const stream = {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream
    opened.push({ stream, track })
    return stream
  })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  })

  let picture = sidePicture(Array<Color>(9).fill('white'))
  const play = vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockResolvedValue(undefined)
  const pause = vi
    .spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(() => {})
  spies.push(
    play,
    pause,
    vi
      .spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get')
      .mockReturnValue(640),
    vi
      .spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get')
      .mockReturnValue(480),
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage() {},
      getImageData: () => picture,
    } as unknown as CanvasRenderingContext2D),
  )

  /** Puts a side with these colours (row by row from the top left) in front of the camera. */
  const show = (colors: readonly Color[]) => {
    picture = sidePicture(colors)
  }
  return { getUserMedia, opened, play, pause, show }
}

const spies: { mockRestore: () => void }[] = []

/** Takes away the camera added by fakeCamera(). */
export function removeFakeCamera() {
  // @ts-expect-error: removing the stand-in added by fakeCamera()
  delete navigator.mediaDevices
  for (const spy of spies.splice(0)) spy.mockRestore()
}

/** What the guide would grab from a side in these colours: each square flat. */
function sidePicture(colors: readonly Color[]): Pixels {
  const data = new Uint8ClampedArray(GRAB_SIZE * GRAB_SIZE * 4)
  const square = GRAB_SIZE / 3
  for (let y = 0; y < GRAB_SIZE; y++) {
    for (let x = 0; x < GRAB_SIZE; x++) {
      const hex =
        STICKER_COLORS[
          colors[Math.floor(y / square) * 3 + Math.floor(x / square)]
        ]
      const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      data.set([...rgb, 255], (y * GRAB_SIZE + x) * 4)
    }
  }
  return { data, width: GRAB_SIZE, height: GRAB_SIZE }
}
