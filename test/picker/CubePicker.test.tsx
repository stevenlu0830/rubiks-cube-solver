import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { PUZZLE_2X2, PUZZLE_4X4, PUZZLE_5X5 } from '../../src/cube/puzzle.ts'
import {
  emptyState,
  solvedState,
  STANDARD_SCHEME,
} from '../../src/cube/state.ts'
import { saveCube } from '../../src/editor/storage.ts'
import { CubePicker } from '../../src/picker/CubePicker.tsx'

const card = (name: string) =>
  screen
    .getAllByRole('listitem')
    .find((item) => item.textContent?.startsWith(name))!

describe('CubePicker', () => {
  beforeEach(() => localStorage.clear())

  it('asks which cube, and offers the 2x2, 3x3, 4x4 and 5x5', () => {
    render(<CubePicker />)
    expect(
      screen.getByRole('heading', { name: "Rubik's Cube Solver" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Which cube are you solving?' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('links each cube that can be solved to its solver', () => {
    render(<CubePicker />)
    const threeByThree = within(card('3x3')).getByRole('link')
    expect(threeByThree).toHaveAttribute('href', '#/3x3')
    expect(threeByThree).toHaveTextContent("3x3The classic Rubik's cube")
    const twoByTwo = within(card('2x2')).getByRole('link')
    expect(twoByTwo).toHaveAttribute('href', '#/2x2')
    expect(twoByTwo).toHaveTextContent('2x2The pocket cube')
    const fourByFour = within(card('4x4')).getByRole('link')
    expect(fourByFour).toHaveAttribute('href', '#/4x4')
    expect(fourByFour).toHaveTextContent('4x4Four layers, no fixed centres')
    for (const ready of ['2x2', '3x3', '4x4']) {
      expect(card(ready)).not.toHaveTextContent('Coming soon')
    }
  })

  it('shows the 5x5 as coming soon, with no link yet', () => {
    render(<CubePicker />)
    expect(card('5x5')).toHaveTextContent(
      '5x5Five layers, fixed centresComing soon',
    )
    expect(within(card('5x5')).queryByRole('link')).toBeNull()
  })

  it("doesn't say a 5x5 is in progress while it's coming soon, even with one saved", () => {
    saveCube(solvedState(STANDARD_SCHEME, PUZZLE_5X5))
    render(<CubePicker />)
    expect(card('5x5')).not.toHaveTextContent('In progress')
  })

  it('says when a 4x4 is part-painted and saved', () => {
    saveCube(solvedState(STANDARD_SCHEME, PUZZLE_4X4))
    render(<CubePicker />)
    expect(card('4x4')).toHaveTextContent('In progress')
    expect(card('3x3')).not.toHaveTextContent('In progress')
    expect(card('2x2')).not.toHaveTextContent('In progress')
  })

  it('says when a 3x3 is part-painted and saved', () => {
    saveCube(solvedState())
    render(<CubePicker />)
    expect(card('3x3')).toHaveTextContent('In progress')
    expect(card('2x2')).not.toHaveTextContent('In progress')
  })

  it('says when a 2x2 is part-painted and saved', () => {
    saveCube(solvedState(STANDARD_SCHEME, PUZZLE_2X2))
    render(<CubePicker />)
    expect(card('2x2')).toHaveTextContent('In progress')
    expect(card('3x3')).not.toHaveTextContent('In progress')
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
