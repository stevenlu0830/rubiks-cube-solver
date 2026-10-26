import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CORNER_CELLS } from './cube/cubies.ts'
import { applyMoves, parseMoves } from './cube/moves.ts'
import {
  CENTER,
  cellIndex,
  emptyState,
  solvedState,
  type CubeState,
} from './cube/state.ts'
import { saveCube } from './editor/storage.ts'
import App from './App.tsx'

// The real 3D view needs WebGL, which the test environment doesn't have.
// This stand-in records what the app asked it to draw and highlight, and
// lets tests "tap" a cell the way a finger on the real cube would.
const view = vi.hoisted(() => ({
  state: [] as CubeState,
  highlight: undefined as readonly number[] | undefined,
  tap: (cell: number): void => void cell,
}))
vi.mock('./view/CubeView.tsx', () => ({
  CubeView: (props: {
    state: CubeState
    onCellTap: (cell: number) => void
    highlight?: readonly number[]
  }) => {
    view.state = props.state
    view.highlight = props.highlight
    view.tap = props.onCellTap
    return null
  },
}))

const tap = (cell: number) => act(() => view.tap(cell))
const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name }))

describe('App', () => {
  beforeEach(() => localStorage.clear())

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

    it('accepts a correctly painted scrambled cube', () => {
      renderWith(applyMoves(solvedState(), parseMoves("R U R' U' F2 D L'")))
      click('Solve')
      expect(screen.getByRole('status')).toHaveTextContent('Looks good')
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
})
