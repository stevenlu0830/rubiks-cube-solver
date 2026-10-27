import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Quaternion } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CORNER_CELLS } from './cube/cubies.ts'
import {
  applyMove,
  applyMoves,
  invertMove,
  invertMoves,
  parseMoves,
  type Move,
} from './cube/moves.ts'
import {
  CENTER,
  cellIndex,
  emptyState,
  isSolved,
  solvedState,
  type CubeState,
} from './cube/state.ts'
import { saveCube } from './editor/storage.ts'
import { pauseMs } from './solve/playback.ts'
import { toFaceletString } from './solver/facelets.ts'
import { SolverError } from './solver/solver.ts'
import { turnBySwipe } from './view/orientation.ts'
import App from './App.tsx'

// The real 3D view needs WebGL, which the test environment doesn't have.
// This stand-in records what the app asked it to draw, highlight and
// animate, and lets tests "tap" a cell or "swipe" the way a finger on the
// real cube would, or say an animated turn has finished.
const view = vi.hoisted(() => ({
  state: [] as CubeState,
  highlight: undefined as readonly number[] | undefined,
  held: false,
  turning: null as Move | null,
  hint: null as Move | null,
  tap: (cell: number): void => void cell,
  swipeTo: (orientation: Quaternion): void => void orientation,
  turnDone: (): void => {},
}))
vi.mock('./view/CubeView.tsx', () => ({
  CubeView: (props: {
    state: CubeState
    onCellTap: (cell: number) => void
    highlight?: readonly number[]
    onOrientationChange: (orientation: Quaternion) => void
    held?: boolean
    turn?: Move | null
    onTurnDone?: () => void
    hint?: Move | null
  }) => {
    view.state = props.state
    view.highlight = props.highlight
    view.held = props.held ?? false
    view.turning = props.turn ?? null
    view.hint = props.hint ?? null
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
vi.mock('./solver/solver.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./solver/solver.ts')>()),
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

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    solver.ready = true
    solver.solve = () => Promise.resolve(parseMoves('R U'))
  })

  it('shows the app title', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: "Rubik's Cube Solver" }),
    ).toBeInTheDocument()
  })

  it('starts with a blank cube and nothing to undo or reset', () => {
    render(<App />)
    expect(view.state).toEqual(emptyState())
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
  })

  it('paints a tapped cell in the selected colour and updates its counter', () => {
    render(<App />)
    tap(7)
    expect(view.state[7]).toBe('white')
    expect(
      screen.getByRole('button', { name: 'white, 1 of 9' }),
    ).toBeInTheDocument()

    click(/^red,/)
    tap(7)
    expect(view.state[7]).toBe('red')
    expect(
      screen.getByRole('button', { name: 'white, 0 of 9' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'red, 1 of 9' }),
    ).toBeInTheDocument()
  })

  it('clears a cell tapped again with the same colour', () => {
    render(<App />)
    tap(7)
    tap(7)
    expect(view.state[7]).toBeNull()
  })

  it('undoes the last change', () => {
    render(<App />)
    tap(1)
    tap(2)
    click('Undo')
    expect(view.state[1]).toBe('white')
    expect(view.state[2]).toBeNull()
  })

  it('fills the centres, then disables the button', () => {
    render(<App />)
    click('Fill centres')
    expect(view.state[cellIndex('U', CENTER)]).toBe('white')
    expect(view.state[cellIndex('F', CENTER)]).toBe('green')
    expect(screen.getByRole('button', { name: 'Fill centres' })).toBeDisabled()
  })

  it('resets everything, and Undo brings it back', () => {
    render(<App />)
    tap(1)
    click('Reset')
    expect(view.state).toEqual(emptyState())
    click('Undo')
    expect(view.state[1]).toBe('white')
  })

  it('keeps the painted cube after a page refresh', () => {
    const { unmount } = render(<App />)
    tap(4)
    unmount()
    render(<App />)
    expect(view.state[4]).toBe('white')
  })

  describe('Solve', () => {
    /** Starts the app with this cube already painted, as if saved earlier. */
    const renderWith = (cube: CubeState) => {
      saveCube(cube)
      render(<App />)
    }

    it('points out every blank square on an unfinished cube', () => {
      render(<App />)
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
      act(() => view.swipeTo(turnBySwipe(new Quaternion(), 'left'))) // red side now in front
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
      render(<App />)
      click('Solve')
      tap(0)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(view.highlight).toBeUndefined()
    })

    it('can be dismissed', () => {
      render(<App />)
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
      render(<App />)
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
      click('‹ Edit cube')
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
})
