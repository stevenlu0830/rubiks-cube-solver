import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyState, solvedState } from '../../src/cube/state.ts'
import { saveCube } from '../../src/editor/storage.ts'
import { CubePicker } from '../../src/picker/CubePicker.tsx'

const card = (name: string) =>
  screen
    .getAllByRole('listitem')
    .find((item) => item.textContent?.startsWith(name))!

describe('CubePicker', () => {
  beforeEach(() => localStorage.clear())

  it('asks which cube, and offers the 2x2 and 3x3', () => {
    render(<CubePicker />)
    expect(
      screen.getByRole('heading', { name: "Rubik's Cube Solver" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Which cube are you solving?' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('links the 3x3 to its solver', () => {
    render(<CubePicker />)
    const link = within(card('3x3')).getByRole('link')
    expect(link).toHaveAttribute('href', '#/3x3')
    expect(link).toHaveTextContent("3x3The classic Rubik's cube")
  })

  it('shows the 2x2 as coming soon, with nothing to tap', () => {
    render(<CubePicker />)
    const twoByTwo = card('2x2')
    expect(twoByTwo).toHaveTextContent('Coming soon')
    expect(within(twoByTwo).queryByRole('link')).toBeNull()
  })

  it('says when a 3x3 is part-painted and saved', () => {
    saveCube(solvedState())
    render(<CubePicker />)
    expect(card('3x3')).toHaveTextContent('In progress')
  })

  it("doesn't say so for a blank cube", () => {
    saveCube(emptyState())
    render(<CubePicker />)
    expect(card('3x3')).not.toHaveTextContent('In progress')
  })

  it('has the About button', () => {
    render(<CubePicker />)
    expect(
      screen.getByRole('button', { name: 'About this app' }),
    ).toBeInTheDocument()
  })
})
