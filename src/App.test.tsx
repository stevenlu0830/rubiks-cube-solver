import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { emptyState, isSolved, type CubeState } from './cube/state.ts'
import App from './App.tsx'

// The real 3D view needs WebGL, which the test environment doesn't have.
// This stand-in just records which cube state the app asked it to draw.
const drawn = vi.hoisted((): CubeState[] => [])
vi.mock('./view/CubeView.tsx', () => ({
  CubeView: ({ state }: { state: CubeState }) => {
    drawn.push(state)
    return null
  },
}))

describe('App', () => {
  it('shows the app title', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: "Rubik's Cube Solver" }),
    ).toBeInTheDocument()
  })

  it('starts with a blank cube', () => {
    render(<App />)
    expect(drawn.at(-1)).toEqual(emptyState())
  })

  it('draws a solved cube when Solved is pressed', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Solved' }))
    expect(isSolved(drawn.at(-1)!)).toBe(true)
  })
})
