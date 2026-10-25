import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CENTER, cellIndex, emptyState, type CubeState } from './cube/state.ts'
import App from './App.tsx'

// The real 3D view needs WebGL, which the test environment doesn't have.
// This stand-in records what the app asked it to draw, and lets tests
// "tap" a cell the way a finger on the real cube would.
const view = vi.hoisted(() => ({
  state: [] as CubeState,
  tap: (cell: number): void => void cell,
}))
vi.mock('./view/CubeView.tsx', () => ({
  CubeView: (props: {
    state: CubeState
    onCellTap: (cell: number) => void
  }) => {
    view.state = props.state
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
})
