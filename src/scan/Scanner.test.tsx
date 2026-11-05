import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fakeCamera, removeFakeCamera } from '../test/fakeCamera.ts'
import { Scanner } from './Scanner.tsx'

/** Pretends the user switched to another app (hidden), or back (visible). */
function setPageHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    value: hidden,
    configurable: true,
  })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

/** Lets the fake camera's answer arrive. */
const cameraAnswers = () => act(async () => {})

const video = () => document.querySelector('video')!
const guide = () => document.querySelector('.scan-guide')

describe('Scanner', () => {
  let camera: ReturnType<typeof fakeCamera>
  beforeEach(() => {
    camera = fakeCamera()
  })
  afterEach(() => {
    removeFakeCamera()
    delete (document as { hidden?: boolean }).hidden
  })

  it('starts the camera and shows it with a 3×3 guide', async () => {
    render(<Scanner />)
    expect(screen.getByRole('status')).toHaveTextContent('Starting the camera')
    expect(guide()).toBeNull()

    await cameraAnswers()
    expect(video().srcObject).toBe(camera.opened[0].stream)
    expect(screen.queryByRole('status')).toBeNull()
    expect(guide()!.children).toHaveLength(9)
  })

  it('switches the camera off when it closes', async () => {
    const { unmount } = render(<Scanner />)
    await cameraAnswers()
    unmount()
    expect(camera.opened[0].track.stop).toHaveBeenCalled()
  })

  it('switches off a camera that only arrives after it closed', async () => {
    let answer!: () => void
    camera.getUserMedia.mockImplementationOnce(async (constraints) => {
      await new Promise<void>((resolve) => (answer = resolve))
      return camera.getUserMedia(constraints)
    })
    const { unmount } = render(<Scanner />)
    unmount()
    await act(async () => answer())
    expect(camera.opened[0].track.stop).toHaveBeenCalled()
  })

  it('explains a refusal, then tries again', async () => {
    camera.getUserMedia.mockRejectedValueOnce(
      new DOMException('', 'NotAllowedError'),
    )
    render(<Scanner />)
    await cameraAnswers()
    expect(screen.getByRole('alert')).toHaveTextContent('The camera is blocked')

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await cameraAnswers()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(video().srcObject).toBe(camera.opened[0].stream)
  })

  it('says so when the camera stops by itself', async () => {
    render(<Scanner />)
    await cameraAnswers()
    act(() => {
      camera.opened[0].track.dispatchEvent(new Event('ended'))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('The camera stopped')
  })

  it('switches the camera off while the app is in the background', async () => {
    render(<Scanner />)
    await cameraAnswers()
    setPageHidden(true)
    expect(camera.opened[0].track.stop).toHaveBeenCalled()

    setPageHidden(false)
    await cameraAnswers()
    expect(camera.getUserMedia).toHaveBeenCalledTimes(2)
    expect(video().srcObject).toBe(camera.opened[1].stream)
  })
})
