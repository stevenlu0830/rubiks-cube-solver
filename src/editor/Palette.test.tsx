import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { COLORS, type Color } from '../cube/state.ts'
import { Palette } from './Palette.tsx'

const counts: Record<Color, number> = {
  white: 3,
  yellow: 0,
  green: 9,
  blue: 1,
  red: 10,
  orange: 4,
}

const renderPalette = (onSelect = vi.fn()) =>
  render(<Palette selected="green" counts={counts} onSelect={onSelect} />)

describe('Palette', () => {
  it('shows all six colours with their counts', () => {
    renderPalette()
    for (const color of COLORS) {
      expect(
        screen.getByRole('button', { name: `${color}, ${counts[color]}/9` }),
      ).toBeInTheDocument()
    }
    expect(screen.getByText('3/9')).toBeInTheDocument()
  })

  it('marks only the selected colour as pressed', () => {
    renderPalette()
    const pressed = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toHaveAccessibleName('green, 9/9')
  })

  it('reports which colour was picked', () => {
    const onSelect = vi.fn()
    renderPalette(onSelect)
    fireEvent.click(screen.getByRole('button', { name: /^blue,/ }))
    expect(onSelect).toHaveBeenCalledWith('blue')
  })

  it("shows each colour's letter only when letters are turned on", () => {
    const { rerender } = renderPalette()
    expect(screen.queryByText('G')).not.toBeInTheDocument()
    rerender(
      <Palette selected="green" counts={counts} onSelect={vi.fn()} letters />,
    )
    expect(screen.getByRole('button', { name: /^green,/ })).toHaveTextContent(
      /^Ggreen, 9\/9$/,
    )
    expect(screen.getByRole('button', { name: /^blue,/ })).toHaveTextContent(
      /^Bblue, 1\/9$/,
    )
    // The letter is only for seeing: screen readers already say the colour.
    expect(screen.getByRole('button', { name: /^blue,/ })).toHaveAccessibleName(
      'blue, 1/9',
    )
  })

  it('flags colours that are complete or over the limit', () => {
    renderPalette()
    expect(screen.getByText('9/9')).toHaveAttribute('data-status', 'full')
    expect(screen.getByText('10/9')).toHaveAttribute('data-status', 'over')
    expect(screen.getByText('4/9')).not.toHaveAttribute('data-status')
  })
})
