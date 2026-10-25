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
        screen.getByRole('button', { name: `${color}, ${counts[color]} of 9` }),
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
    expect(pressed[0]).toHaveAccessibleName('green, 9 of 9')
  })

  it('reports which colour was picked', () => {
    const onSelect = vi.fn()
    renderPalette(onSelect)
    fireEvent.click(screen.getByRole('button', { name: /^blue,/ }))
    expect(onSelect).toHaveBeenCalledWith('blue')
  })

  it('flags colours that are complete or over the limit', () => {
    renderPalette()
    expect(screen.getByText('9/9')).toHaveAttribute('data-status', 'full')
    expect(screen.getByText('10/9')).toHaveAttribute('data-status', 'over')
    expect(screen.getByText('4/9')).not.toHaveAttribute('data-status')
  })
})
