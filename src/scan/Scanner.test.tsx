import { act, fireEvent, render, screen, within } from '@testing-library/react'
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
import type { Rgb } from './colorSpace.ts'
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
    // The live look through the camera runs on a timer: tests move it on.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  })
  afterEach(() => {
    vi.useRealTimers()
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
    /** The colours shown on the photo, as CSS. */
    const dots = (where = '.scan-dots:not(.scan-dots-live)') =>
      [...document.querySelectorAll<HTMLElement>(`${where} .scan-dot`)].map(
        (dot) => dot.style.background,
      )
    /** Lets the scanner take its next live look through the camera. */
    const lookThrough = () => act(() => vi.advanceTimersByTime(250))
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

    describe('accuracy', () => {
      const RED_ORANGE: Rgb = [220, 65, 35] // about as red as it is orange
      const REDDISH: Rgb = [215, 60, 45] // an orange that looks red on its own
      const square = (name: string) =>
        screen.getByRole('button', { name: new RegExp(`^${name}:`) })

      it('shows live dots of what a photo would read, before taking it', async () => {
        render(<Harness />)
        await cameraAnswers()
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
        camera.show(side)
        lookThrough()
        expect(dots('.scan-dots-live')).toEqual(asCss(side))
        expect(dots()).toEqual([]) // no photo yet
      })

      it.each([
        ['too dark', [[20, 15, 15]], {}, 'Too dark'],
        [
          'shine on a red sticker',
          [[183, 18, 52]],
          { glare: 0.4 },
          'Shine on the stickers',
        ],
      ] as [string, Rgb[], { glare?: number }, string][])(
        'warns before the photo: %s',
        async (_, colors, options, warning) => {
          render(<Harness />)
          await cameraAnswers()
          camera.show(Array(9).fill(colors[0]), options)
          lookThrough()
          expect(screen.getByRole('status')).toHaveTextContent(warning)
        },
      )

      it('says to hold still while the picture keeps changing', async () => {
        render(<Harness />)
        await cameraAnswers()
        camera.show(Array(9).fill('green'))
        lookThrough()
        expect(screen.queryByRole('status')).toBeNull()
        camera.show(Array(9).fill('blue'))
        lookThrough()
        expect(screen.getByRole('status')).toHaveTextContent('Hold still')
        lookThrough() // and when it settles, the warning goes
        expect(screen.queryByRole('status')).toBeNull()
      })

      it('outlines a square it is unsure of, and lets the user pick its colour', async () => {
        render(<Harness />)
        await cameraAnswers()
        camera.show([
          'green',
          RED_ORANGE,
          'green',
          'green',
          'green',
          'green',
          'green',
          'green',
          'green',
        ])
        click('Take photo')
        expect(square('top')).toHaveAccessibleName(/, not sure$/)
        expect(square('top').querySelector('[data-unsure]')).not.toBeNull()
        expect(instruction()).toMatch(/^1 square might be wrong/)

        fireEvent.click(square('top'))
        const picker = screen.getByRole('group', {
          name: 'Colour for this square',
        })
        fireEvent.click(
          within(picker).getByRole('button', { name: /^yellow,/ }),
        )
        const cell = frontCells(new Quaternion())[1]
        expect(app.cube[cell]).toBe('yellow')
        expect(square('top')).toHaveAccessibleName('top: yellow')
        expect(
          screen.queryByRole('group', { name: 'Colour for this square' }),
        ).toBeNull()

        // A new photo of the side starts afresh.
        click('Retake')
        click('Take photo')
        expect(app.cube[cell]).not.toBe('yellow')
      })

      it('shares colours out over every side: a later photo can change an earlier one', async () => {
        render(<Harness />)
        await cameraAnswers()
        const first = frontCells(new Quaternion())
        camera.show([
          REDDISH,
          REDDISH,
          'green',
          'green',
          'green',
          'green',
          'green',
          'green',
          'green',
        ])
        click('Take photo')
        expect([app.cube[first[0]], app.cube[first[1]]]).toEqual(['red', 'red'])

        click('Next side ›')
        camera.show(Array(9).fill('red'))
        click('Take photo')
        // Ten reds can't all be red, so the two least red ones are orange.
        expect([app.cube[first[0]], app.cube[first[1]]]).toEqual([
          'orange',
          'orange',
        ])
      })

      it('keeps colours picked by hand when later photos come in', async () => {
        render(<Harness />)
        await cameraAnswers()
        const first = frontCells(new Quaternion())
        camera.show([
          REDDISH,
          'green',
          'green',
          'green',
          'green',
          'green',
          'green',
          'green',
          'green',
        ])
        click('Take photo')
        fireEvent.click(square('top left'))
        fireEvent.click(
          within(
            screen.getByRole('group', { name: 'Colour for this square' }),
          ).getByRole('button', { name: /^red,/ }),
        )
        click('Next side ›')
        camera.show(Array(9).fill('red'))
        click('Take photo')
        expect(app.cube[first[0]]).toBe('red')
      })

      it('says when a photo looks like a side already scanned', async () => {
        render(<Harness />)
        await cameraAnswers()
        camera.show(Array(9).fill('green'))
        click('Take photo')
        click('Next side ›')
        click('Take photo') // the green side again: the real cube wasn't turned
        expect(instruction()).toBe(
          "You've already scanned the green side. Turn your cube to match the one below, then retake.",
        )
        camera.show(Array(9).fill('red'))
        click('Retake')
        click('Take photo')
        expect(instruction()).not.toMatch(/already scanned/)
      })
    })

    describe('?scan-debug', () => {
      beforeEach(() => {
        localStorage.clear()
        window.history.replaceState(null, '', '/?scan-debug')
      })
      afterEach(() => window.history.replaceState(null, '', '/'))

      it('records what each photo read, with the colours as fixed, and the light', async () => {
        render(<Harness />)
        await cameraAnswers()
        expect(screen.getByText('0 scans saved')).toBeInTheDocument()
        camera.show(Array(9).fill('blue'))
        click('Take photo')
        fireEvent.change(screen.getByLabelText('Light'), {
          target: { value: 'warm bulb' },
        })

        const [scan] = JSON.parse(
          localStorage.getItem('rubiks-cube-solver/scan-debug')!,
        )
        expect(scan.light).toBe('warm bulb')
        expect(scan.sides.F.colors).toEqual(Array(9).fill('blue'))
        expect(scan.sides.F.rgb[0]).toEqual([0, 70, 173])
        expect(screen.getByText('1 scan saved')).toBeInTheDocument()

        click('Clear')
        expect(localStorage.getItem('rubiks-cube-solver/scan-debug')).toBeNull()
      })

      it('is hidden without ?scan-debug', async () => {
        window.history.replaceState(null, '', '/')
        render(<Harness />)
        await cameraAnswers()
        expect(screen.queryByRole('region', { name: 'Scan debug' })).toBeNull()
        camera.show(Array(9).fill('blue'))
        click('Take photo')
        expect(localStorage.getItem('rubiks-cube-solver/scan-debug')).toBeNull()
      })
    })
  })
})
