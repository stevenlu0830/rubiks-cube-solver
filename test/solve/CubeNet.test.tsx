import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PUZZLE_2X2 } from '../../src/cube/puzzle.ts'
import {
  emptyState,
  solvedState,
  STANDARD_SCHEME,
} from '../../src/cube/state.ts'
import { PuzzleContext } from '../../src/puzzleContext.ts'
import { CubeNet } from '../../src/solve/CubeNet.tsx'
import { STICKER_COLORS } from '../../src/view/colors.ts'

const map = () => screen.getByRole('img', { name: 'Map of all six faces' })
const faces = () => [...map().querySelectorAll('.cube-net-face')]

describe('CubeNet', () => {
  it('shows a 3x3 as six faces of 9 squares', () => {
    render(<CubeNet state={solvedState()} activeFace={null} />)
    expect(faces()).toHaveLength(6)
    for (const face of faces()) expect(face.children).toHaveLength(9)
    expect(map().style.getPropertyValue('--net-size')).toBe('3')
  })

  it('shows a 2x2 as six faces of 4 squares, in their colours', () => {
    render(
      <PuzzleContext value={PUZZLE_2X2}>
        <CubeNet
          state={solvedState(STANDARD_SCHEME, PUZZLE_2X2)}
          activeFace="R"
        />
      </PuzzleContext>,
    )
    expect(faces()).toHaveLength(6)
    for (const face of faces()) expect(face.children).toHaveLength(4)
    expect(map().style.getPropertyValue('--net-size')).toBe('2')
    const right = faces()[1] // faces come in U R F D L B order
    expect(right).toHaveAttribute('data-active')
    for (const square of right.children) {
      expect((square as HTMLElement).style.background).toBe(
        hexToRgb(STICKER_COLORS[STANDARD_SCHEME.R]),
      )
    }
  })

  it('leaves blank squares see-through', () => {
    render(
      <PuzzleContext value={PUZZLE_2X2}>
        <CubeNet state={emptyState(PUZZLE_2X2)} activeFace={null} />
      </PuzzleContext>,
    )
    const square = faces()[0].children[0] as HTMLElement
    expect(square.style.background).toBe('transparent')
  })
})

/** How the browser reports a #rrggbb colour back: rgb(r, g, b). */
function hexToRgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}
