import { vi, type Mock } from 'vitest'

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
  return { getUserMedia, opened }
}

/** Takes away the camera added by fakeCamera(). */
export function removeFakeCamera() {
  // @ts-expect-error: removing the stand-in added by fakeCamera()
  delete navigator.mediaDevices
}
