import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Quaternion } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORNER_CELLS, cornerCellsOf } from '../src/cube/cubies.ts'
import {
  applyMove,
  applyMoves,
  invertMove,
  invertMoves,
  parseMoves,
  type Move,
} from '../src/cube/moves.ts'
import {
  CENTER,
  cellIndex,
  emptyState,
  isSolved,
  solvedState,
  STANDARD_SCHEME,
  type CubeState,
} from '../src/cube/state.ts'
import { PUZZLE_2X2 } from '../src/cube/puzzle.ts'
import { loadCube, saveCube } from '../src/editor/storage.ts'
import { pauseMs } from '../src/solve/playback.ts'
import { toFaceletString } from '../src/solver/facelets.ts'
import { SolverError } from '../src/solver/solver.ts'
import { fakeCamera, removeFakeCamera } from './helpers/fakeCamera.ts'
import {
  cubeAsShown,
  frontCells,
  turnBySwipe,
} from '../src/view/orientation.ts'
import { SolverPage } from '../src/SolverPage.tsx'

// The real 3D view needs WebGL, which the test environment doesn't have.
// This stand-in records what the app asked it to draw, highlight and
// animate, and lets tests "tap" a cell or "swipe" the way a finger on the
// real cube would, or say an animated turn has finished.
const view = vi.hoisted(() => ({
  state: [] as CubeState,
  highlight: undefined as readonly number[] | undefined,
  orientation: undefined as Quaternion | undefined,
  held: false,
  turning: null as Move | null,
  hint: null as Move | null,
  letters: false,
  tap: (cell: number): void => void cell,
  swipeTo: (orientation: Quaternion): void => void orientation,
  turnDone: (): void => {},
}))
vi.mock('../src/view/CubeView.tsx', () => ({
  CubeView: (props: {
    state: CubeState
    onCellTap: (cell: number) => void
    highlight?: readonly number[]
    orientation?: Quaternion
    onOrientationChange: (orientation: Quaternion) => void
    held?: boolean
    turn?: Move | null
    onTurnDone?: () => void
    hint?: Move | null
    letters?: boolean
  }) => {
    view.state = props.state
    view.highlight = props.highlight
    view.orientation = props.orientation
    view.held = props.held ?? false
    view.turning = props.turn ?? null
    view.hint = props.hint ?? null
    view.letters = props.letters ?? false
    view.tap = props.onCellTap
    view.swipeTo = props.onOrientationChange
    view.turnDone = props.onTurnDone ?? (() => {})
    return null
  },
}))

// The real solver runs in a Web Worker, which the test environment doesn't
// have. This stand-in lets each test decide what the solver answers.
const solver = vi.hoisted(() => ({
  ready: true,
  solve: (facelets: string): Promise<Move[]> => {
    void facelets
    return Promise.resolve([])
  },
}))
vi.mock('../src/solver/solver.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/solver/solver.ts')>()),
  getSolver: () => ({
    isReady: () => solver.ready,
    solve: (facelets: string) => solver.solve(facelets),
  }),
}))

/** A promise the test resolves or rejects itself, to look at the app mid-solve. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const tap = (cell: number) => act(() => view.tap(cell))
const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name }))

describe('SolverPage', () => {
  beforeEach(() => {
    localStorage.clear()
    solver.ready = true
    solver.solve = () => Promise.resolve(parseMoves('R U'))
  })

  it('says which cube it solves', () => {
    render(<SolverPage />)
    expect(
      screen.getByRole('heading', { name: '3x3 Cube Solver' }),
    ).toBeInTheDocument()
  })

  it('links back to picking a cube while painting', () => {
    render(<SolverPage />)
    expect(screen.getByRole('link', { name: '‹ Cubes' })).toHaveAttribute(
      'href',
      '#/',
    )
  })

  it('starts with a blank cube and nothing to undo or reset', () => {
    render(<SolverPage />)
    expect(view.state).toEqual(emptyState())
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
  })

  it('paints a tapped cell in the selected colour and updates its counter', () => {
    render(<SolverPage />)
    tap(7)
    expect(view.state[7]).toBe('white')
    expect(
      screen.getByRole('button', { name: 'white, 1/9' }),
    ).toBeInTheDocument()

    click(/^red,/)
    tap(7)
    expect(view.state[7]).toBe('red')
    expect(
      screen.getByRole('button', { name: 'white, 0/9' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'red, 1/9' })).toBeInTheDocument()
  })

  it('clears a cell tapped again with the same colour', () => {
    render(<SolverPage />)
    tap(7)
    tap(7)
    expect(view.state[7]).toBeNull()
  })

  it('undoes the last change', () => {
    render(<SolverPage />)
    tap(1)
    tap(2)
    click('Undo')
    expect(view.state[1]).toBe('white')
    expect(view.state[2]).toBeNull()
  })

  it('fills the centres, then disables the button', () => {
    render(<SolverPage />)
    click('Fill centres')
    expect(view.state[cellIndex('U', CENTER)]).toBe('white')
    expect(view.state[cellIndex('F', CENTER)]).toBe('green')
    expect(screen.getByRole('button', { name: 'Fill centres' })).toBeDisabled()
  })

  it('resets everything, and Undo brings it back', () => {
    render(<SolverPage />)
    tap(1)
    click('Reset')
    expect(view.state).toEqual(emptyState())
    click('Undo')
    expect(view.state[1]).toBe('white')
  })

  it('keeps the painted cube after a page refresh', () => {
    const { unmount } = render(<SolverPage />)
    tap(4)
    unmount()
    render(<SolverPage />)
    expect(view.state[4]).toBe('white')
  })

  describe('Solve', () => {
    /** Starts the app with this cube already painted, as if saved earlier. */
    const renderWith = (cube: CubeState) => {
      saveCube(cube)
      render(<SolverPage />)
    }

    it('points out every blank square on an unfinished cube', () => {
      render(<SolverPage />)
      click('Solve')
      expect(screen.getByRole('status')).toHaveTextContent(
        '54 squares are still blank',
      )
      expect(view.highlight).toHaveLength(54)
    })

    it('says when the cube is already solved', () => {
      renderWith(solvedState())
      click('Solve')
      expect(screen.getByRole('status')).toHaveTextContent('already solved')
      expect(view.highlight).toBeUndefined()
    })

    const scrambled = applyMoves(solvedState(), parseMoves("R U R' U' F2 D L'"))

    it('solves a correctly painted cube, then says how to hold it', async () => {
      const answer = deferred<Move[]>()
      const asked: string[] = []
      solver.solve = (facelets) => {
        asked.push(facelets)
        return answer.promise
      }
      renderWith(scrambled)
      click('Solve')
      expect(screen.getByRole('status')).toHaveTextContent('Finding a solution')
      expect(screen.getByRole('button', { name: 'Solving…' })).toBeDisabled()
      expect(asked).toEqual([toFaceletString(scrambled)])

      await act(async () => answer.resolve(parseMoves("F2 R U'")))
      expect(screen.getByLabelText('How to hold your cube')).toHaveTextContent(
        'Hold your cube with green facing you and white on top',
      )
      // Solve mode: the cube is held still, and the painting tools are gone.
      expect(view.held).toBe(true)
      expect(view.state).toEqual(scrambled)
      expect(screen.queryByRole('group', { name: 'Paint colour' })).toBeNull()
      expect(
        within(screen.getByRole('list', { name: 'Steps' })).getAllByRole(
          'listitem',
        ),
      ).toHaveLength(3)
    })

    it('uses the way the cube is turned on screen as the holding position', async () => {
      const asked: string[] = []
      solver.solve = (facelets) => {
        asked.push(facelets)
        return Promise.resolve(parseMoves('R U'))
      }
      renderWith(scrambled)
      const turned = turnBySwipe(new Quaternion(), 'left') // red side now in front
      act(() => view.swipeTo(turned))
      expect(view.orientation).toBe(turned) // so the 3D cube turns there
      await act(async () => click('Solve'))
      expect(screen.getByLabelText('How to hold your cube')).toHaveTextContent(
        'Hold your cube with red facing you and white on top',
      )
      // The solver sees the cube as shown: the same as a y turn of the whole cube.
      expect(asked).toEqual([toFaceletString(applyMove(scrambled, 'y'))])
    })

    it('says when the solver is still getting ready', () => {
      solver.ready = false
      solver.solve = () => new Promise(() => {})
      renderWith(scrambled)
      click('Solve')
      expect(screen.getByRole('status')).toHaveTextContent(
        'Getting the solver ready',
      )
    })

    it('explains when the solver fails', async () => {
      solver.solve = () =>
        Promise.reject(new SolverError('timeout', 'The solver took too long.'))
      renderWith(scrambled)
      await act(async () => click('Solve'))
      expect(screen.getByRole('status')).toHaveTextContent(
        'The solver took too long. Please try again.',
      )
    })

    it('drops an answer that arrives after the cube was edited', async () => {
      const answer = deferred<Move[]>()
      solver.solve = () => answer.promise
      renderWith(scrambled)
      click('Solve')
      tap(0)
      await act(async () => answer.resolve(parseMoves('R U')))
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('explains a twisted corner and highlights the corners', () => {
      const cube = [...solvedState()]
      const [up, right, front] = CORNER_CELLS[0] // white, red, green
      cube[up] = 'green'
      cube[right] = 'white'
      cube[front] = 'red'
      renderWith(cube)
      click('Solve')
      expect(screen.getByRole('status')).toHaveTextContent(
        'A corner is twisted',
      )
      expect(view.highlight).toHaveLength(24)
    })

    it('hides the message and highlight as soon as the cube is edited', () => {
      render(<SolverPage />)
      click('Solve')
      tap(0)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(view.highlight).toBeUndefined()
    })

    it('can be dismissed', () => {
      render(<SolverPage />)
      click('Solve')
      click('Dismiss')
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(view.highlight).toBeUndefined()
    })
  })

  describe('solve mode', () => {
    const scramble = parseMoves("R U R' U' F2 D L'")
    const scrambled = applyMoves(solvedState(), scramble)
    const solution = invertMoves(scramble) // 7 moves that undo the scramble

    async function openSolveMode() {
      solver.solve = () => Promise.resolve(solution)
      saveCube(scrambled)
      render(<SolverPage />)
      await act(async () => click('Solve'))
    }
    const finishTurn = () => act(() => view.turnDone())
    const stepButtons = () =>
      within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('button')

    it('waits for "I\'m ready" before showing any step', async () => {
      await openSolveMode()
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
      expect(view.hint).toBeNull()
      click("I'm ready")
      expect(screen.getByText('Step 1 of 7')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
      expect(view.hint).toBe(solution[0]) // the arrow for the first move
    })

    it('animates Next and Back, updating the cube when each turn ends', async () => {
      await openSolveMode()
      click("I'm ready")
      click('Next')
      expect(view.turning).toBe(solution[0])
      expect(view.state).toEqual(scrambled) // not yet: the turn is animating
      finishTurn()
      expect(view.turning).toBeNull()
      expect(view.state).toEqual(applyMove(scrambled, solution[0]))
      expect(screen.getByText('Step 2 of 7')).toBeInTheDocument()
      expect(stepButtons()[1]).toHaveAttribute('aria-current', 'step')

      click('Back')
      expect(view.turning).toBe(invertMove(solution[0]))
      finishTurn()
      expect(view.state).toEqual(scrambled)
      expect(screen.getByText('Step 1 of 7')).toBeInTheDocument()
    })

    it('steps through the whole solution and shows Solved 🎉', async () => {
      await openSolveMode()
      click("I'm ready")
      for (let i = 0; i < solution.length; i++) {
        click('Next')
        finishTurn()
      }
      expect(
        screen.getByRole('heading', { name: 'Solved 🎉' }),
      ).toBeInTheDocument()
      expect(isSolved(view.state)).toBe(true)
      expect(view.hint).toBeNull()
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    })

    it('can go back from the Solved screen', async () => {
      await openSolveMode()
      click("I'm ready")
      fireEvent.click(stepButtons()[solution.length - 1])
      click('Next')
      finishTurn()
      click('Back')
      expect(view.turning).toBe(invertMove(solution.at(-1)!))
      expect(screen.getByText('Step 7 of 7')).toBeInTheDocument()
      finishTurn()
      expect(screen.getByText('Step 7 of 7')).toBeInTheDocument()
      expect(view.state).toEqual(applyMoves(scrambled, solution.slice(0, 6)))
    })

    it('plays the whole solution by itself with Play', async () => {
      vi.useFakeTimers()
      try {
        await openSolveMode()
        click("I'm ready")
        click('Play')
        for (let i = 0; i < solution.length; i++) {
          expect(view.turning).toBe(solution[i])
          finishTurn()
          act(() => vi.advanceTimersByTime(pauseMs(1)))
        }
        expect(
          screen.getByRole('heading', { name: 'Solved 🎉' }),
        ).toBeInTheDocument()
        expect(isSolved(view.state)).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })

    it('jumps straight to a tapped step', async () => {
      await openSolveMode()
      click("I'm ready")
      fireEvent.click(stepButtons()[3])
      expect(view.turning).toBeNull()
      expect(view.state).toEqual(applyMoves(scrambled, solution.slice(0, 3)))
      expect(screen.getByText('Step 4 of 7')).toBeInTheDocument()
    })

    it('goes back to painting the same cube with Edit cube', async () => {
      await openSolveMode()
      click("I'm ready")
      click('Next')
      finishTurn()
      // One way back at a time: to painting first, then to the cubes.
      expect(screen.queryByRole('link', { name: '‹ Cubes' })).toBeNull()
      click('‹ Edit cube')
      expect(screen.getByRole('link', { name: '‹ Cubes' })).toBeInTheDocument()
      expect(view.held).toBe(false)
      expect(view.state).toEqual(scrambled)
      expect(
        screen.getByRole('group', { name: 'Paint colour' }),
      ).toBeInTheDocument()
    })

    it('starts a blank cube with Solve another cube, which Undo can bring back', async () => {
      await openSolveMode()
      click("I'm ready")
      fireEvent.click(stepButtons()[solution.length - 1])
      click('Next')
      finishTurn()
      click('Solve another cube')
      expect(view.state).toEqual(emptyState())
      click('Undo')
      expect(view.state).toEqual(scrambled)
    })
  })

  describe('scanning', () => {
    // The scanner's live look through the camera runs on a timer, left still here.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    })
    afterEach(() => {
      vi.useRealTimers()
      removeFakeCamera()
    })

    const scanner = () =>
      screen.queryByRole('region', { name: 'Scan your cube' })

    it('has no Scan button where the browser cannot use a camera', () => {
      render(<SolverPage />)
      expect(screen.queryByRole('button', { name: 'Scan' })).toBeNull()
    })

    it('shows the camera instead of the painting tools, until Done', async () => {
      const camera = fakeCamera()
      render(<SolverPage />)
      click('Solve') // a message about blank squares, with them highlighted
      await act(async () => click('Scan'))

      expect(scanner()).toBeInTheDocument()
      expect(camera.getUserMedia).toHaveBeenCalled()
      expect(screen.queryByRole('group', { name: 'Paint colour' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Solve' })).toBeNull()
      expect(view.tap).toBeUndefined() // tapping the cube doesn't paint
      expect(screen.queryByRole('link', { name: '‹ Cubes' })).toBeNull()

      click('‹ Done')
      expect(screen.getByRole('link', { name: '‹ Cubes' })).toBeInTheDocument()
      expect(scanner()).toBeNull()
      expect(view.highlight).toBeUndefined()
      expect(camera.opened[0].track.stop).toHaveBeenCalled()
      expect(
        screen.getByRole('group', { name: 'Paint colour' }),
      ).toBeInTheDocument()
      tap(0)
      expect(view.state[0]).toBe('white')
    })

    it('outlines the side facing you, and follows it as the cube turns', async () => {
      fakeCamera()
      render(<SolverPage />)
      await act(async () => click('Scan'))
      expect(view.highlight).toEqual(frontCells(new Quaternion()))

      const turned = turnBySwipe(new Quaternion(), 'down') // top side now in front
      act(() => view.swipeTo(turned))
      expect(view.orientation).toBe(turned)
      expect(view.highlight).toEqual(frontCells(turned))
      expect(view.highlight).toContain(cellIndex('U', CENTER))
    })

    it('reads all six sides with the camera, ready to solve', async () => {
      const camera = fakeCamera()
      const asked: string[] = []
      solver.solve = (facelets) => {
        asked.push(facelets)
        return Promise.resolve(parseMoves('R U'))
      }
      const scrambled = applyMoves(solvedState(), parseMoves("R U2 F' L D B2"))
      render(<SolverPage />)
      await act(async () => click('Scan'))
      for (let side = 0; side < 6; side++) {
        // The real cube, turned the way the 3D cube shows, in front of the camera.
        camera.show(
          frontCells(view.orientation!).map((cell) => scrambled[cell]!),
        )
        click('Take photo')
        click(side < 5 ? 'Next side ›' : 'Done')
      }

      expect(scanner()).toBeNull()
      expect(view.state).toEqual(scrambled)
      await act(async () => click('Solve'))
      expect(asked).toEqual([
        toFaceletString(cubeAsShown(scrambled, view.orientation!)),
      ])
      expect(screen.getByLabelText('How to hold your cube')).toBeInTheDocument()
    })

    it('takes each photo back with a single Undo', async () => {
      const camera = fakeCamera()
      render(<SolverPage />)
      await act(async () => click('Scan'))
      camera.show(Array(9).fill('blue'))
      click('Take photo')
      click('‹ Done')
      expect(view.state.filter((cell) => cell === 'blue')).toHaveLength(9)
      click('Undo')
      expect(view.state).toEqual(emptyState())
    })

    it("can't start while solving", () => {
      fakeCamera()
      solver.solve = () => new Promise(() => {}) // never answers
      saveCube(applyMoves(solvedState(), parseMoves('R U')))
      render(<SolverPage />)
      click('Solve')
      expect(screen.getByRole('button', { name: 'Scan' })).toBeDisabled()
    })
  })

  describe('settings', () => {
    // The test browser can't open popovers, so the switches stay hidden here
    // (the end-to-end tests open the menu for real): reach in regardless.
    const toggle = (name: RegExp) =>
      fireEvent.click(screen.getByRole('checkbox', { name, hidden: true }))

    /** Pretends to be a phone that can vibrate, recording each buzz. */
    function vibrations() {
      const vibrate = vi.fn<(pattern: VibratePattern) => boolean>(() => true)
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrate,
        configurable: true,
      })
      return vibrate
    }
    afterEach(() => {
      // @ts-expect-error: removing the stand-in added by vibrations()
      delete navigator.vibrate
    })

    it('writes colour letters on the cube and palette, and remembers that', () => {
      const { unmount } = render(<SolverPage />)
      expect(view.letters).toBe(false)
      toggle(/^Letters on stickers/)
      expect(view.letters).toBe(true)
      expect(screen.getByRole('button', { name: /^green,/ })).toHaveTextContent(
        /^G/,
      )
      unmount()
      render(<SolverPage />)
      expect(view.letters).toBe(true)
      expect(
        screen.getByRole('checkbox', {
          name: /^Letters on stickers/,
          hidden: true,
        }),
      ).toBeChecked()
    })

    it('has no vibration switch where the phone cannot vibrate', () => {
      render(<SolverPage />)
      expect(
        screen.queryByRole('checkbox', { name: /^Vibration/, hidden: true }),
      ).not.toBeInTheDocument()
    })

    it('buzzes on a paint tap and on a problem, until turned off', () => {
      const vibrate = vibrations()
      render(<SolverPage />)
      tap(0)
      expect(vibrate).toHaveBeenLastCalledWith(10)
      click('Solve') // 53 blank squares
      expect(vibrate).toHaveBeenLastCalledWith([40, 60, 40])
      toggle(/^Vibration/)
      tap(1)
      click('Solve')
      expect(vibrate).toHaveBeenCalledTimes(2)
    })

    it('buzzes when the last move is done', async () => {
      const vibrate = vibrations()
      solver.solve = () => Promise.resolve(parseMoves("R U'"))
      saveCube(applyMoves(solvedState(), parseMoves("U R'")))
      render(<SolverPage />)
      await act(async () => click('Solve'))
      click("I'm ready")
      click('Next')
      act(() => view.turnDone())
      expect(vibrate).not.toHaveBeenCalled()
      click('Next')
      act(() => view.turnDone())
      expect(vibrate).toHaveBeenCalledWith([30, 50, 30, 50, 90])
    })
  })

  describe('a 2x2', () => {
    afterEach(() => removeFakeCamera())

    it('says which cube it is for, with a blank 2x2 of 24 squares', () => {
      render(<SolverPage cube="2x2" />)
      expect(
        screen.getByRole('heading', { name: '2x2 Cube Solver' }),
      ).toBeInTheDocument()
      expect(view.state).toEqual(emptyState(PUZZLE_2X2))
    })

    it('paints squares, counting each colour out of 4', () => {
      render(<SolverPage cube="2x2" />)
      expect(
        screen.getByRole('button', { name: 'white, 0/4' }),
      ).toBeInTheDocument()
      tap(0)
      tap(23)
      expect(view.state[0]).toBe('white')
      expect(view.state[23]).toBe('white')
      expect(
        screen.getByRole('button', { name: 'white, 2/4' }),
      ).toBeInTheDocument()
    })

    it('has Undo and Reset, but no Fill centres: a 2x2 has none', () => {
      render(<SolverPage cube="2x2" />)
      tap(3)
      click('Undo')
      expect(view.state[3]).toBeNull()
      tap(3)
      click('Reset')
      expect(view.state).toEqual(emptyState(PUZZLE_2X2))
      expect(screen.queryByRole('button', { name: 'Fill centres' })).toBeNull()
    })

    it('reads all six sides with the camera, outlining the 4 squares facing you, ready to solve', async () => {
      const camera = fakeCamera()
      const asked: string[] = []
      solver.solve = (facelets) => {
        asked.push(facelets)
        return Promise.resolve(parseMoves('R U'))
      }
      const scrambled = applyMoves(
        solvedState(STANDARD_SCHEME, PUZZLE_2X2),
        parseMoves("R U2 F' L D B2"),
      )
      render(<SolverPage cube="2x2" />)
      await act(async () => click('Scan'))
      expect(view.highlight).toEqual(frontCells(new Quaternion(), PUZZLE_2X2))
      for (let side = 0; side < 6; side++) {
        // The real cube, turned the way the 3D cube shows, in front of the camera.
        camera.show(
          frontCells(view.orientation!, PUZZLE_2X2).map(
            (cell) => scrambled[cell]!,
          ),
        )
        click('Take photo')
        click(side < 5 ? 'Next side ›' : 'Done')
      }

      expect(
        screen.queryByRole('region', { name: 'Scan your cube' }),
      ).toBeNull()
      expect(view.state).toEqual(scrambled)
      await act(async () => click('Solve'))
      expect(asked).toEqual([
        toFaceletString(cubeAsShown(scrambled, view.orientation!)),
      ])
      expect(screen.getByLabelText('How to hold your cube')).toBeInTheDocument()
    })

    describe('Solve', () => {
      const SOLVED_2X2 = solvedState(STANDARD_SCHEME, PUZZLE_2X2)
      const renderWith = (cube: CubeState) => {
        saveCube(cube)
        render(<SolverPage cube="2x2" />)
      }

      it('asks for all 24 squares, pointing out the blank ones', () => {
        render(<SolverPage cube="2x2" />)
        click('Solve')
        expect(screen.getByRole('status')).toHaveTextContent(
          '24 squares are still blank. Paint all 24 to match your cube.',
        )
        expect(view.highlight).toHaveLength(24)
      })

      it('says when the 2x2 is already solved', () => {
        renderWith(SOLVED_2X2)
        click('Solve')
        expect(screen.getByRole('status')).toHaveTextContent('already solved')
      })

      it('points at a twisted corner, without asking the solver', () => {
        solver.solve = vi.fn(() => Promise.resolve([]))
        const cube = [...SOLVED_2X2]
        const [up, right, front] = cornerCellsOf(PUZZLE_2X2)[0] // white, red, green
        ;[cube[up], cube[right], cube[front]] = ['green', 'white', 'red']
        renderWith(cube)
        click('Solve')
        expect(screen.getByRole('status')).toHaveTextContent(
          'A corner is twisted',
        )
        expect(view.highlight).toHaveLength(24)
        expect(solver.solve).not.toHaveBeenCalled()
      })

      it('sends the cube as seen to the solver, then says to hold it by the corner that never moves', async () => {
        // The scramble leaves the bottom left corner at the front alone: yellow
        // underneath, orange on the left, green in front.
        const cube = applyMoves(SOLVED_2X2, parseMoves("R U2 R' U"))
        const answer = deferred<Move[]>()
        solver.solve = vi.fn(() => answer.promise)
        renderWith(cube)
        // Turned to show the right side in front: the solver gets the cube as seen.
        const turned = turnBySwipe(new Quaternion(), 'left')
        act(() => view.swipeTo(turned))

        click('Solve')
        expect(screen.getByRole('status')).toHaveTextContent(
          'Finding a solution',
        )
        const shown = cubeAsShown(cube, turned)
        expect(solver.solve).toHaveBeenCalledWith(toFaceletString(shown))
        expect(vi.mocked(solver.solve).mock.calls[0][0]).toHaveLength(24)

        await act(async () => answer.resolve(parseMoves("F U2 R'")))
        // Seen from the right, that corner is at the back, bottom left: green
        // is now on its left, and orange at the back.
        expect(
          screen.getByLabelText('How to hold your cube'),
        ).toHaveTextContent(
          'Hold your cube so the corner at the back, bottom left has yellow underneath, green on the left and orange at the back.',
        )
        expect(view.held).toBe(true)
        expect(view.state).toEqual(shown)
      })

      it('steps through the solution with arrows and the map, to Solved, then starts another', async () => {
        const scramble = parseMoves("R U2 F' R")
        const solution = invertMoves(scramble)
        solver.solve = () => Promise.resolve(solution)
        renderWith(applyMoves(SOLVED_2X2, scramble))
        await act(async () => click('Solve'))
        click("I'm ready")
        expect(screen.getByText('Step 1 of 4')).toBeInTheDocument()
        expect(view.hint).toBe(solution[0]) // the arrow on the 3D cube
        const map = screen.getByRole('img', { name: 'Map of all six faces' })
        expect(map.querySelectorAll('span')).toHaveLength(24)

        for (const move of solution) {
          click('Next')
          expect(view.turning).toBe(move)
          act(() => view.turnDone())
        }
        expect(
          screen.getByRole('heading', { name: 'Solved 🎉' }),
        ).toBeInTheDocument()
        expect(isSolved(view.state)).toBe(true)

        click('Solve another cube')
        expect(view.state).toEqual(emptyState(PUZZLE_2X2))
      })

      it('says so when one move solves it', async () => {
        solver.solve = () => Promise.resolve(parseMoves("U'"))
        renderWith(applyMoves(SOLVED_2X2, parseMoves('U')))
        await act(async () => click('Solve'))
        click("I'm ready")
        expect(screen.getByText('Step 1 of 1')).toBeInTheDocument()
        click('Next')
        act(() => view.turnDone())
        expect(
          screen.getByText("That's the only move: your cube is solved."),
        ).toBeInTheDocument()
      })

      it('says so if the solver fails', async () => {
        solver.solve = () =>
          Promise.reject(new SolverError('timeout', 'too slow'))
        renderWith(applyMoves(SOLVED_2X2, parseMoves('R U')))
        await act(async () => click('Solve'))
        expect(screen.getByRole('status')).toHaveTextContent(
          'The solver took too long',
        )
      })
    })

    it('keeps the painted 2x2 after a page refresh, apart from the 3x3', () => {
      const { unmount } = render(<SolverPage cube="2x2" />)
      tap(5)
      unmount()
      expect(loadCube(localStorage, PUZZLE_2X2)?.[5]).toBe('white')
      expect(loadCube()).toBeNull()

      render(<SolverPage cube="2x2" />)
      expect(view.state[5]).toBe('white')
    })

    it('opens a 2x2 saved earlier', () => {
      const saved = [...emptyState(PUZZLE_2X2)]
      saved[10] = 'green'
      saveCube(saved)
      render(<SolverPage cube="2x2" />)
      expect(view.state).toEqual(saved)
      expect(
        screen.getByRole('button', { name: 'green, 1/4' }),
      ).toBeInTheDocument()
    })
  })
})
