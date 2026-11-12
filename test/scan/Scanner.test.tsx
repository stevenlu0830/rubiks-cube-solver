import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { Quaternion } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyMoves, parseMoves } from '../../src/cube/moves.ts'
import { PUZZLE_2X2, PUZZLE_3X3, type Puzzle } from '../../src/cube/puzzle.ts'
import {
  CENTER,
  emptyState,
  solvedState,
  STANDARD_SCHEME,
  type Color,
  type CubeState,
} from '../../src/cube/state.ts'
import { PuzzleContext } from '../../src/puzzleContext.ts'
import { fakeCamera, removeFakeCamera } from '../helpers/fakeCamera.ts'
import { STICKER_COLORS } from '../../src/view/colors.ts'
import type { SwipeDirection } from '../../src/view/gestures.ts'
import {
  frontCells,
  frontFace,
  screenSideOf,
  turnBySwipe,
} from '../../src/view/orientation.ts'
import type { Rgb } from '../../src/scan/colorSpace.ts'
import { Scanner } from '../../src/scan/Scanner.tsx'
import { turnCells } from '../../src/scan/turnedSides.ts'

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

function Harness({
  autoPhoto = false,
  letters = false,
  puzzle = PUZZLE_3X3,
}: {
  autoPhoto?: boolean
  letters?: boolean
  /** Which cube the page is for, as SolverPage says. */
  puzzle?: Puzzle
}) {
  const [orientation, setOrientation] = useState(() => new Quaternion())
  const [cube, setCube] = useState<CubeState>(() => emptyState(puzzle))
  // Let the tests see the latest of each, and swipe as a finger would.
  useEffect(() => {
    app.orientation = orientation
    app.cube = cube
    app.swipe = (direction) =>
      act(() => setOrientation((current) => turnBySwipe(current, direction)))
  })
  return (
    <PuzzleContext value={puzzle}>
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
        autoPhoto={autoPhoto}
        letters={letters}
      />
    </PuzzleContext>
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
    /** Everything a screen reader hears from the instructions. */
    const heard = () => document.querySelector('.scan-instruction')!.textContent
    /** The instruction on screen, without what's only for screen readers. */
    const instruction = () => {
      const hidden = document.querySelector(
        '.scan-instruction .visually-hidden',
      )
      return heard().slice(hidden?.textContent.length ?? 0)
    }
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

    describe('auto photo', () => {
      const SIDE: Color[] = [
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
      const photos = () => screen.queryByText(/ of 6 sides$/)?.textContent
      const looks = (count: number) => {
        for (let i = 0; i < count; i++) lookThrough()
      }
      const viewfinder = () => document.querySelector('.viewfinder')!

      it('takes the photo by itself once the side has been still and clear for half a second', async () => {
        render(<Harness autoPhoto />)
        await cameraAnswers()
        expect(instruction()).toBe(
          'Hold any side of your cube up to the camera so it fills the grid, then hold it still for a photo.',
        )
        camera.show(SIDE)
        looks(2) // still for a quarter of a second: nearly
        expect(dots()).toEqual([])
        expect(viewfinder()).toHaveAttribute('data-ready') // the guide turns green
        lookThrough()
        expect(dots()).toEqual(asCss(SIDE))
        expect(photos()).toBe('1 of 6 sides')
      })

      it('starts again when the picture moves', async () => {
        render(<Harness autoPhoto />)
        await cameraAnswers()
        camera.show(Array(9).fill('green'))
        looks(2)
        camera.show(SIDE) // the cube moved
        looks(2)
        expect(photos()).toBe('0 of 6 sides')
        lookThrough()
        expect(dots()).toEqual(asCss(SIDE))
      })

      it('waits for the real cube to be turned after Next side', async () => {
        render(<Harness autoPhoto />)
        await cameraAnswers()
        camera.show(Array(9).fill('green'))
        looks(3)
        click('Next side ›')
        looks(5) // the camera still sees the green side
        expect(photos()).toBe('1 of 6 sides')

        camera.show(Array(9).fill('red'))
        looks(3)
        expect(photos()).toBe('2 of 6 sides')
        expect(app.cube[frontCells(app.orientation)[0]]).toBe('red')
      })

      it('only photographs a cube, not a flat picture of colours', async () => {
        render(<Harness autoPhoto />)
        await cameraAnswers()
        camera.show(SIDE, { plastic: false })
        looks(5)
        expect(photos()).toBe('0 of 6 sides')
        expect(viewfinder()).not.toHaveAttribute('data-ready')
        click('Take photo') // the button still works
        expect(photos()).toBe('1 of 6 sides')
      })

      it('leaves retakes to the button', async () => {
        render(<Harness autoPhoto />)
        await cameraAnswers()
        camera.show(SIDE)
        looks(3)
        click('Retake')
        looks(5)
        expect(dots()).toEqual([])
        expect(instruction()).toMatch(/^This side is done/)
      })

      it('is off unless switched on', async () => {
        render(<Harness />)
        await cameraAnswers()
        expect(instruction()).toMatch(/then take a photo\.$/)
        camera.show(SIDE)
        looks(5)
        expect(photos()).toBe('0 of 6 sides')
      })
    })

    describe('a side photographed turned round', () => {
      const SCRAMBLED = applyMoves(
        solvedState(),
        parseMoves("R U2 F' L D B2 R' U F2 L'"),
      )

      it('says which side looks turned, and turns it back', async () => {
        render(<Harness />)
        await cameraAnswers()
        let turnedSide: Color | null = null
        for (let side = 1; side <= 6; side++) {
          let shows = frontCells(app.orientation)
          if (side === 2) {
            // The real cube held a quarter turn round from the 3D one.
            shows = turnCells(shows, 1)
            turnedSide = SCRAMBLED[shows[CENTER]]
          }
          camera.show(shows.map((cell) => SCRAMBLED[cell]!))
          click('Take photo')
          if (side < 6) click('Next side ›')
        }
        expect(app.cube).not.toEqual(SCRAMBLED)
        expect(instruction()).toBe(
          `The ${turnedSide} side looks turned. Fix it?`,
        )

        expect(document.querySelector('.scan-instruction')).toHaveAttribute(
          'data-warning',
        )

        click('Fix it')
        expect(app.cube).toEqual(SCRAMBLED)
        expect(instruction()).toMatch(/^All six sides are in/)
        expect(button('Fix it')).toBeNull()
      })
    })

    describe('a camera facing you, like a laptop', () => {
      beforeEach(() => {
        removeFakeCamera()
        camera = fakeCamera({ facing: 'user' })
      })

      it('is shown like a mirror, but reads each side the right way round', async () => {
        render(<Harness />)
        await cameraAnswers()
        expect(document.querySelector('.viewfinder')).toHaveAttribute(
          'data-mirrored',
        )
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
        click('Take photo')
        frontCells(new Quaternion()).forEach((cell, n) => {
          expect(app.cube[cell]).toBe(side[n])
        })
      })

      it('says to turn the side to the camera, not to you', async () => {
        render(<Harness />)
        await cameraAnswers()
        click('Take photo')
        click('Next side ›')
        expect(instruction()).toBe(
          'Turn your cube to the left, so the side on your left faces the camera, then take a photo.',
        )
        app.swipe('down')
        expect(instruction()).toBe(
          'Turn your cube so the side outlined below faces the camera, then take a photo.',
        )
      })
    })

    it("isn't mirrored for a phone's back camera", async () => {
      render(<Harness />)
      await cameraAnswers()
      expect(document.querySelector('.viewfinder')).not.toHaveAttribute(
        'data-mirrored',
      )
    })

    describe('the torch', () => {
      const torch = () => screen.queryByRole('button', { name: 'Torch' })

      it('is offered where the camera has one, and switches on and off', async () => {
        removeFakeCamera()
        camera = fakeCamera({ torch: true })
        render(<Harness />)
        await cameraAnswers()
        expect(torch()).toHaveAttribute('aria-pressed', 'false')

        await act(async () => fireEvent.click(torch()!))
        expect(camera.opened[0].track.applyConstraints).toHaveBeenCalledWith({
          advanced: [{ torch: true }],
        })
        expect(torch()).toHaveAttribute('aria-pressed', 'true')
        await act(async () => fireEvent.click(torch()!))
        expect(torch()).toHaveAttribute('aria-pressed', 'false')
      })

      it('is not offered where the camera has none', async () => {
        render(<Harness />)
        await cameraAnswers()
        expect(torch()).toBeNull()
      })

      it('goes away if it fails to switch on', async () => {
        removeFakeCamera()
        camera = fakeCamera({ torch: true })
        render(<Harness />)
        await cameraAnswers()
        camera.opened[0].track.applyConstraints.mockRejectedValueOnce(
          new DOMException('', 'OverconstrainedError'),
        )
        await act(async () => fireEvent.click(torch()!))
        expect(torch()).toBeNull()
      })
    })

    it('tells screen readers the colours each photo read, row by row', async () => {
      render(<Harness />)
      await cameraAnswers()
      camera.show([
        'red',
        'white',
        'blue',
        'green',
        'green',
        'yellow',
        'orange',
        [220, 65, 35], // about as red as it is orange
        'white',
      ])
      click('Take photo')
      expect(heard()).toMatch(
        /^Colours read, row by row: red, white, blue; green, green, yellow; orange, (red|orange) \(not sure\), white\. /,
      )
      // It's in the instructions, which screen readers read out as they change.
      expect(document.querySelector('.scan-instruction')).toHaveAttribute(
        'aria-live',
        'polite',
      )
    })

    it('writes the colour letters on the dots when letters are on', async () => {
      render(<Harness letters />)
      await cameraAnswers()
      camera.show([
        'red',
        'white',
        'blue',
        'green',
        'green',
        'yellow',
        'orange',
        'red',
        'white',
      ])
      lookThrough()
      const letters = (where: string) =>
        [...document.querySelectorAll(`${where} .scan-dot`)]
          .map((dot) => dot.textContent)
          .join('')
      expect(letters('.scan-dots-live')).toBe('RWBGGYORW')
      click('Take photo')
      expect(letters('.scan-dots')).toBe('RWBGGYORW')
    })

    describe('a 2x2', () => {
      const SCRAMBLED_2X2 = applyMoves(
        solvedState(STANDARD_SCHEME, PUZZLE_2X2),
        parseMoves("R U2 F' L D B2 R' U F2"),
      )
      const twoByTwoCells = () => frontCells(app.orientation, PUZZLE_2X2)
      /** The colours of whichever side of the scrambled 2x2 faces the camera. */
      const sideColors = () =>
        twoByTwoCells().map((cell) => SCRAMBLED_2X2[cell]!)

      it('shows a 2×2 guide, and live dots for its 4 squares', async () => {
        render(<Harness puzzle={PUZZLE_2X2} />)
        await cameraAnswers()
        expect(guide()!.children).toHaveLength(4)
        camera.show(['red', 'white', 'green', 'blue'])
        lookThrough()
        expect(dots('.scan-dots-live')).toEqual(
          asCss(['red', 'white', 'green', 'blue']),
        )
      })

      it('scans all six sides of a scrambled 2x2 in five quarter turns, then is done', async () => {
        render(<Harness puzzle={PUZZLE_2X2} />)
        await cameraAnswers()
        for (let side = 1; side <= 6; side++) {
          camera.show(sideColors())
          click('Take photo')
          expect(dots()).toHaveLength(4)
          expect(screen.getByText(`${side} of 6 sides`)).toBeInTheDocument()
          if (side < 6) click('Next side ›')
        }
        expect(app.turns).toHaveLength(5)
        expect(app.cube).toEqual(SCRAMBLED_2X2)
        expect(instruction()).toMatch(/^All six sides are in/)
      })

      it('names its squares top left, top right, bottom left and bottom right', async () => {
        render(<Harness puzzle={PUZZLE_2X2} />)
        await cameraAnswers()
        camera.show(['red', 'white', 'green', 'blue'])
        click('Take photo')
        const squares = within(
          screen.getByRole('group', {
            name: 'Colours read: tap a square to change it',
          }),
        ).getAllByRole('button')
        expect(
          squares.map((square) => square.getAttribute('aria-label')),
        ).toEqual([
          'top left: red',
          'top right: white',
          'bottom left: green',
          'bottom right: blue',
        ])
        expect(heard()).toMatch(
          /^Colours read, row by row: red, white; green, blue\. /,
        )
        fireEvent.click(squares[3])
        expect(
          screen.getByText('Pick the colour of the bottom right square:'),
        ).toBeInTheDocument()
      })

      it('says when a photo looks like a side already scanned, naming it by where it is', async () => {
        render(<Harness puzzle={PUZZLE_2X2} />)
        await cameraAnswers()
        camera.show(['red', 'white', 'green', 'blue'])
        click('Take photo')
        click('Next side ›') // the side just scanned goes to the left
        // The real cube wasn't turned: the same side again, but held turned.
        camera.show(['green', 'red', 'blue', 'white'])
        click('Take photo')
        expect(instruction()).toBe(
          "This looks like the left side, which you've already scanned. If it is, turn your cube to match the one below, then retake.",
        )
        expect(document.querySelector('.scan-instruction')).toHaveAttribute(
          'data-warning',
        )
      })

      it('says which side looks turned by where it is, and turns it back', async () => {
        render(<Harness puzzle={PUZZLE_2X2} />)
        await cameraAnswers()
        let turnedFace = null as ReturnType<typeof frontFace> | null
        for (let side = 1; side <= 6; side++) {
          let shows = twoByTwoCells()
          if (side === 2) {
            // The real cube held a quarter turn round from the 3D one.
            shows = turnCells(shows, 1)
            turnedFace = frontFace(app.orientation)
          }
          camera.show(shows.map((cell) => SCRAMBLED_2X2[cell]!))
          click('Take photo')
          if (side < 6) click('Next side ›')
        }
        expect(app.cube).not.toEqual(SCRAMBLED_2X2)
        const where = screenSideOf(app.orientation, turnedFace!)
        expect(instruction()).toBe(`The ${where} side looks turned. Fix it?`)

        // Named by where it is now: swiping the 3D cube changes the name.
        app.swipe('left')
        expect(instruction()).toBe(
          `The ${screenSideOf(app.orientation, turnedFace!)} side looks turned. Fix it?`,
        )
        click('Fix it')
        expect(app.cube).toEqual(SCRAMBLED_2X2)
      })

      it('takes a photo by itself, with Auto photo on', async () => {
        render(<Harness puzzle={PUZZLE_2X2} autoPhoto />)
        await cameraAnswers()
        camera.show(['red', 'white', 'green', 'blue'])
        for (let i = 0; i < 3; i++) lookThrough()
        expect(screen.getByText('1 of 6 sides')).toBeInTheDocument()
        expect(dots()).toEqual(asCss(['red', 'white', 'green', 'blue']))
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
        expect(scan.cube).toBe('3x3')
        expect(scan.sides.F.colors).toEqual(Array(9).fill('blue'))
        expect(scan.sides.F.rgb[0]).toEqual([0, 70, 173])
        expect(screen.getByText('1 scan saved')).toBeInTheDocument()

        click('Clear')
        expect(localStorage.getItem('rubiks-cube-solver/scan-debug')).toBeNull()
      })

      it('records which cube was scanned', async () => {
        render(<Harness puzzle={PUZZLE_2X2} />)
        await cameraAnswers()
        camera.show(['red', 'white', 'green', 'blue'])
        click('Take photo')
        const [scan] = JSON.parse(
          localStorage.getItem('rubiks-cube-solver/scan-debug')!,
        )
        expect(scan.cube).toBe('2x2')
        expect(scan.sides.F.colors).toEqual(['red', 'white', 'green', 'blue'])
        expect(scan.sides.F.cells).toEqual(
          frontCells(new Quaternion(), PUZZLE_2X2),
        )
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
