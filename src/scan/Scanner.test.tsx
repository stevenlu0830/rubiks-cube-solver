import { act, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { Quaternion } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emptyState,
  solvedState,
  type Color,
  type CubeState,
} from '../cube/state.ts'
import { fakeCamera, removeFakeCamera } from '../test/fakeCamera.ts'
import { STICKER_COLORS } from '../view/colors.ts'
import type { SwipeDirection } from '../view/gestures.ts'
import { frontCells, frontFace, turnBySwipe } from '../view/orientation.ts'
import { Scanner } from './Scanner.tsx'

/**
 * Stands in for the app around the scanner: keeps which way the 3D cube is
 * turned (Next side turns it) and the cube painted from the photos.
 */
const app = {
  orientation: new Quaternion(),
  cube: emptyState() as CubeState,
  turns: [] as Quaternion[],
  done: vi.fn(),
  swipe: (direction: SwipeDirection): void => void direction,
}

function Harness() {
  const [orientation, setOrientation] = useState(() => new Quaternion())
  const [cube, setCube] = useState<CubeState>(emptyState)
  // Let the tests see the latest of each, and swipe as a finger would.
  useEffect(() => {
    app.orientation = orientation
    app.cube = cube
    app.swipe = (direction) =>
      act(() => setOrientation((current) => turnBySwipe(current, direction)))
  })
  return (
    <Scanner
      cube={cube}
      orientation={orientation}
      onTurn={(to) => {
        app.turns.push(to)
        setOrientation(to)
      }}
      onPaint={(paints) =>
        setCube((current) => {
          const next = [...current]
          for (const [cell, color] of paints) next[cell] = color
          return next
        })
      }
      onDone={app.done}
    />
  )
}

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
    render(<Harness />)
    expect(screen.getByRole('status')).toHaveTextContent('Starting the camera')
    expect(guide()).toBeNull()

    await cameraAnswers()
    expect(video().srcObject).toBe(camera.opened[0].stream)
    expect(screen.queryByRole('status')).toBeNull()
    expect(guide()!.children).toHaveLength(9)
  })

  it('switches the camera off when it closes', async () => {
    const { unmount } = render(<Harness />)
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
    const { unmount } = render(<Harness />)
    unmount()
    await act(async () => answer())
    expect(camera.opened[0].track.stop).toHaveBeenCalled()
  })

  it('explains a refusal, then tries again', async () => {
    camera.getUserMedia.mockRejectedValueOnce(
      new DOMException('', 'NotAllowedError'),
    )
    render(<Harness />)
    await cameraAnswers()
    expect(screen.getByRole('alert')).toHaveTextContent('The camera is blocked')

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await cameraAnswers()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(video().srcObject).toBe(camera.opened[0].stream)
  })

  it('says so when the camera stops by itself', async () => {
    render(<Harness />)
    await cameraAnswers()
    act(() => {
      camera.opened[0].track.dispatchEvent(new Event('ended'))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('The camera stopped')
  })

  it('switches the camera off while the app is in the background', async () => {
    render(<Harness />)
    await cameraAnswers()
    setPageHidden(true)
    expect(camera.opened[0].track.stop).toHaveBeenCalled()

    setPageHidden(false)
    await cameraAnswers()
    expect(camera.getUserMedia).toHaveBeenCalledTimes(2)
    expect(video().srcObject).toBe(camera.opened[1].stream)
  })

  describe('photos', () => {
    const SOLVED = solvedState()
    /** The colours of whichever side of a solved cube faces the camera. */
    const frontColors = () =>
      frontCells(app.orientation).map((cell) => SOLVED[cell]!)
    const button = (name: string | RegExp) =>
      screen.queryByRole('button', { name })
    const click = (name: string | RegExp) =>
      fireEvent.click(screen.getByRole('button', { name }))
    const instruction = () =>
      document.querySelector('.scan-instruction')!.textContent
    const dots = () =>
      [...document.querySelectorAll<HTMLElement>('.scan-dot')].map(
        (dot) => dot.style.background,
      )
    const asCss = (colors: Color[]) =>
      colors.map((color) => {
        const probe = document.createElement('i')
        probe.style.background = STICKER_COLORS[color]
        return probe.style.background
      })

    beforeEach(() => {
      app.turns = []
      app.done.mockClear()
    })

    it('waits for the camera before a photo can be taken', async () => {
      render(<Harness />)
      expect(button('Take photo')).toBeDisabled()
      await cameraAnswers()
      expect(button('Take photo')).toBeEnabled()
      expect(instruction()).toMatch(/^Hold any side of your cube/)
    })

    it('holds the picture still with the colours read, and paints that side', async () => {
      const side: Color[] = [
        'red',
        'white',
        'blue',
        'green',
        'green',
        'yellow',
        'orange',
        'red',
        'white',
      ]
      render(<Harness />)
      await cameraAnswers()
      camera.show(side)
      click('Take photo')

      expect(camera.pause).toHaveBeenCalled()
      expect(dots()).toEqual(asCss(side))
      frontCells(new Quaternion()).forEach((cell, n) => {
        expect(app.cube[cell]).toBe(side[n])
      })
      expect(screen.getByText('1 of 6 sides')).toBeInTheDocument()
      expect(instruction()).toMatch(/^Check the colours/)
      expect(button('Take photo')).toBeNull()
      expect(button('Retake')).toBeInTheDocument()
    })

    it('starts the picture again for a retake', async () => {
      render(<Harness />)
      await cameraAnswers()
      click('Take photo')
      camera.play.mockClear()
      click('Retake')

      expect(camera.play).toHaveBeenCalled()
      expect(dots()).toEqual([])
      expect(instruction()).toMatch(/^This side is done/)
      camera.show(Array(9).fill('blue'))
      click('Take photo')
      expect(app.cube[frontCells(new Quaternion())[0]]).toBe('blue')
      expect(screen.getByText('1 of 6 sides')).toBeInTheDocument()
    })

    it('turns the cube to the next side, and says how to turn the real one', async () => {
      render(<Harness />)
      await cameraAnswers()
      click('Take photo')
      click('Next side ›')

      expect(app.turns).toEqual([turnBySwipe(new Quaternion(), 'left')])
      expect(frontFace(app.orientation)).toBe('R')
      expect(dots()).toEqual([])
      expect(instruction()).toBe(
        'Turn your cube to the left, so its right side faces you, then take a photo.',
      )
    })

    it('scans all six sides in five quarter turns, then is done', async () => {
      render(<Harness />)
      await cameraAnswers()
      for (let side = 1; side <= 6; side++) {
        camera.show(frontColors())
        click('Take photo')
        expect(screen.getByText(`${side} of 6 sides`)).toBeInTheDocument()
        if (side < 6) click('Next side ›')
      }
      expect(app.turns).toHaveLength(5)
      expect(app.cube).toEqual(SOLVED)
      expect(instruction()).toMatch(/^All six sides are in/)
      expect(button('Next side ›')).toBeNull()

      click('Done')
      expect(app.done).toHaveBeenCalled()
    })

    it('lets the user turn the cube themselves, and photograph any side', async () => {
      render(<Harness />)
      await cameraAnswers()
      click('Take photo')
      app.swipe('down') // the top side to the front, instead of the right
      expect(dots()).toEqual([]) // the photo was of the other side
      expect(instruction()).toMatch(/^Turn your cube the same way/)
      expect(button('Next side ›')).toBeNull() // this side isn't done yet

      camera.show(frontColors())
      click('Take photo')
      expect(screen.getByText('2 of 6 sides')).toBeInTheDocument()
      expect(app.cube[frontCells(app.orientation)[4]]).toBe('white')

      app.swipe('up') // back to the first side
      expect(instruction()).toMatch(/^This side is done/)
      expect(button('Next side ›')).toBeInTheDocument()
    })

    it('turns the cube around when only the side at the back is left', async () => {
      render(<Harness />)
      await cameraAnswers()
      const photograph = () => {
        camera.show(frontColors())
        click('Take photo')
      }
      // Front, right, left, top and bottom, swiping between them by hand…
      photograph()
      for (const swipes of [
        ['left'],
        ['right', 'right'],
        ['left', 'down'],
        ['up', 'up'],
      ] as SwipeDirection[][]) {
        for (const direction of swipes) app.swipe(direction)
        photograph()
      }
      app.swipe('down') // …then back to the front, which is done.
      expect(screen.getByText('5 of 6 sides')).toBeInTheDocument()

      click('Next side ›')
      expect(frontFace(app.orientation)).toBe('B')
      expect(instruction()).toBe(
        'Turn your cube around, so its back side faces you, then take a photo.',
      )
      photograph()
      expect(app.cube).toEqual(SOLVED)
    })

    it('shows a map of all six sides, with the one in front marked', async () => {
      render(<Harness />)
      expect(
        screen.getByRole('img', { name: 'Map of all six faces' }),
      ).toBeInTheDocument()
      expect(
        document.querySelector('.cube-net-face[data-active]'),
      ).not.toBeNull()
    })
  })
})
