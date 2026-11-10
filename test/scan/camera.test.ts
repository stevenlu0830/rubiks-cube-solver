import { afterEach, describe, expect, it } from 'vitest'
import { fakeCamera, removeFakeCamera } from '../helpers/fakeCamera.ts'
import {
  cameraErrorMessage,
  canOfferCamera,
  facesUser,
  hasTorch,
  openCamera,
  stopCamera,
  switchTorch,
} from '../../src/scan/camera.ts'

/** Pretends the page was opened from a plain http:// address (not localhost). */
function insecurePage() {
  Object.defineProperty(window, 'isSecureContext', {
    value: false,
    configurable: true,
  })
}

afterEach(() => {
  removeFakeCamera()
  delete (window as { isSecureContext?: boolean }).isSecureContext
})

describe('openCamera', () => {
  it('asks for the back camera, and no sound', async () => {
    const camera = fakeCamera()
    const stream = await openCamera()
    expect(stream).toBe(camera.opened[0].stream)
    expect(camera.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: false,
        video: expect.objectContaining({
          facingMode: { ideal: 'environment' },
        }),
      }),
    )
  })

  it.each([
    ['NotAllowedError', 'The camera is blocked.'],
    ['SecurityError', 'The camera is blocked.'],
    ['NotFoundError', 'No camera was found'],
    ['OverconstrainedError', 'No camera was found'],
    ['NotReadableError', 'being used by another app'],
    ['AbortError', 'being used by another app'],
    ['SomeNewError', "The camera couldn't start."],
  ])('explains a %s in plain words', async (name, message) => {
    const camera = fakeCamera()
    camera.getUserMedia.mockRejectedValueOnce(new DOMException('', name))
    const error = await openCamera().catch((error: unknown) => error)
    expect(cameraErrorMessage(error)).toContain(message)
  })

  it('says the page must be on https://, without asking the browser', async () => {
    const camera = fakeCamera()
    insecurePage()
    const error = await openCamera().catch((error: unknown) => error)
    expect(cameraErrorMessage(error)).toContain('secure (https://) address')
    expect(camera.getUserMedia).not.toHaveBeenCalled()
  })

  it('says there is no camera where the browser has no camera support', async () => {
    const error = await openCamera().catch((error: unknown) => error)
    expect(cameraErrorMessage(error)).toContain('No camera was found')
  })
})

describe('stopCamera', () => {
  it('switches off every track', async () => {
    const camera = fakeCamera()
    stopCamera(await openCamera())
    expect(camera.opened[0].track.stop).toHaveBeenCalled()
  })
})

describe('facesUser', () => {
  const track = (settings: MediaTrackSettings) =>
    ({ getSettings: () => settings }) as MediaStreamTrack

  it("is false for a phone's back camera, and true for a front one", () => {
    expect(facesUser(track({ facingMode: 'environment' }))).toBe(false)
    expect(facesUser(track({ facingMode: 'user' }))).toBe(true)
  })

  it("is true for a laptop's camera, which doesn't say", () => {
    expect(facesUser(track({}))).toBe(true)
  })
})

describe('the torch', () => {
  it('is there only where the camera says it has one', async () => {
    fakeCamera({ torch: true })
    const [withTorch] = (await openCamera()).getVideoTracks()
    expect(hasTorch(withTorch)).toBe(true)
    removeFakeCamera()

    fakeCamera()
    const [without] = (await openCamera()).getVideoTracks()
    expect(hasTorch(without)).toBe(false)
    expect(hasTorch({} as MediaStreamTrack)).toBe(false) // can't even ask
  })

  it('is switched on and off through the camera', async () => {
    const camera = fakeCamera({ torch: true })
    const [track] = (await openCamera()).getVideoTracks()
    await switchTorch(track, true)
    expect(camera.opened[0].track.applyConstraints).toHaveBeenCalledWith({
      advanced: [{ torch: true }],
    })
  })
})

describe('canOfferCamera', () => {
  it('is true where the browser can use a camera', () => {
    fakeCamera()
    expect(canOfferCamera()).toBe(true)
  })

  it('is false where it cannot', () => {
    expect(canOfferCamera()).toBe(false)
  })

  it('is true on a page that is not https://, so the button can explain', () => {
    insecurePage()
    expect(canOfferCamera()).toBe(true)
  })
})
