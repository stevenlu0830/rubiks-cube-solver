import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CubeState } from '../src/cube/state.ts'
import App from '../src/App.tsx'

// The 3D view needs WebGL and the solver a Web Worker, which the test
// environment doesn't have: stand-ins that let a test "tap" a cell.
const view = vi.hoisted(() => ({
  state: [] as CubeState,
  tap: (cell: number): void => void cell,
}))
vi.mock('../src/view/CubeView.tsx', () => ({
  CubeView: (props: {
    state: CubeState
    onCellTap: (cell: number) => void
  }) => {
    view.state = props.state
    view.tap = props.onCellTap
    return null
  },
}))
vi.mock('../src/solver/solver.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/solver/solver.ts')>()),
  getSolver: () => ({ isReady: () => true, solve: async () => [] }),
}))

/** Waits for the browser to notice the address changed, as after tapping a link. */
async function addressChange(change: () => void) {
  await act(async () => {
    const changed = new Promise((resolve) =>
      window.addEventListener('hashchange', resolve, { once: true }),
    )
    change()
    await changed
  })
}

const goTo = (hash: string) => addressChange(() => (location.hash = hash))
const heading = (name: string) =>
  screen.getByRole('heading', { level: 1, name })

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    history.replaceState(null, '', '/')
  })
  afterEach(() => history.replaceState(null, '', '/'))

  it('opens on the page for picking a cube', () => {
    render(<App />)
    expect(heading("Rubik's Cube Solver")).toBeInTheDocument()
    expect(document.title).toBe("Rubik's Cube Solver")
  })

  it('opens the 3x3 solver straight away at #/3x3, e.g. from a bookmark', () => {
    history.replaceState(null, '', '/#/3x3')
    render(<App />)
    expect(heading('3x3 Cube Solver')).toBeInTheDocument()
    expect(document.title).toBe("3x3 · Rubik's Cube Solver")
  })

  it('opens the 2x2 page at #/2x2, though the picker still says it is coming soon', () => {
    history.replaceState(null, '', '/#/2x2')
    render(<App />)
    expect(heading('2x2 Cube Solver')).toBeInTheDocument()
    expect(view.state).toHaveLength(24)
    expect(document.title).toBe("2x2 · Rubik's Cube Solver")
  })

  it('keeps the 2x2 and 3x3 apart when switching between them', async () => {
    history.replaceState(null, '', '/#/3x3')
    render(<App />)
    act(() => view.tap(4))

    await goTo('#/2x2')
    expect(view.state).toHaveLength(24)
    expect(view.state.every((cell) => cell === null)).toBe(true)
    act(() => view.tap(0))

    await goTo('#/3x3')
    expect(view.state).toHaveLength(54)
    expect(view.state[4]).toBe('white')
    expect(view.state[0]).toBeNull()

    await goTo('#/2x2')
    expect(view.state[0]).toBe('white')
  })

  it('goes to the 3x3 from its card, and back with ‹ Cubes', async () => {
    render(<App />)
    await addressChange(() =>
      fireEvent.click(screen.getByRole('link', { name: /^3x3/ })),
    )
    expect(location.hash).toBe('#/3x3')
    expect(heading('3x3 Cube Solver')).toBeInTheDocument()

    await addressChange(() =>
      fireEvent.click(screen.getByRole('link', { name: '‹ Cubes' })),
    )
    expect(heading("Rubik's Cube Solver")).toBeInTheDocument()
  })

  it("moves the focus to the new page's title, so screen readers announce it", async () => {
    render(<App />)
    await goTo('#/3x3')
    expect(document.activeElement).toBe(heading('3x3 Cube Solver'))
    expect(document.title).toBe("3x3 · Rubik's Cube Solver")
    await goTo('#/')
    expect(document.activeElement).toBe(heading("Rubik's Cube Solver"))
  })

  it("doesn't move the focus on first opening the app", () => {
    render(<App />)
    expect(document.activeElement).toBe(document.body)
  })

  it('keeps a part-painted cube while picking another page', async () => {
    history.replaceState(null, '', '/#/3x3')
    render(<App />)
    act(() => view.tap(4))
    const painted = view.state

    await goTo('#/')
    expect(screen.getByText('In progress')).toBeInTheDocument()
    await goTo('#/3x3')
    expect(view.state).toEqual(painted)
    expect(view.state[4]).toBe('white')
  })
})
