import { COLORS, type Color } from '../cube/state.ts'
import { usePuzzle } from '../puzzleContext.ts'
import { COLOR_LETTERS, LETTER_INK, STICKER_COLORS } from '../view/colors.ts'
import './Palette.css'

interface PaletteProps {
  selected: Color
  counts: Record<Color, number>
  onSelect: (color: Color) => void
  /** Show each colour's letter, as on the stickers. */
  letters?: boolean
  /** What the group of colours is for, for screen readers. */
  label?: string
}

/** The six paint colours, each showing how many cells use it out of the 9 a real 3x3 has (4 on a 2x2). */
export function Palette({
  selected,
  counts,
  onSelect,
  letters = false,
  label = 'Paint colour',
}: PaletteProps) {
  const { cellsPerColor } = usePuzzle()
  return (
    <div className="palette" role="group" aria-label={label}>
      {COLORS.map((color) => {
        const count = counts[color]
        const status =
          count > cellsPerColor
            ? 'over'
            : count === cellsPerColor
              ? 'full'
              : undefined
        return (
          <button
            key={color}
            type="button"
            className="swatch"
            aria-pressed={color === selected}
            onClick={() => onSelect(color)}
          >
            <span
              className="swatch-chip"
              aria-hidden="true"
              style={{
                background: STICKER_COLORS[color],
                color: LETTER_INK[color],
              }}
            >
              {letters && COLOR_LETTERS[color]}
            </span>
            {/* Read out as "white, 3/9": the name includes the visible text,
                so voice control ("tap 3/9") works too. */}
            <span className="visually-hidden">{color},</span>{' '}
            <span className="swatch-count" data-status={status}>
              {count}/{cellsPerColor}
            </span>
          </button>
        )
      })}
    </div>
  )
}
