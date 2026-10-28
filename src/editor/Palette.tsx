import { CELLS_PER_COLOR, COLORS, type Color } from '../cube/state.ts'
import { COLOR_LETTERS, LETTER_INK, STICKER_COLORS } from '../view/colors.ts'
import './Palette.css'

interface PaletteProps {
  selected: Color
  counts: Record<Color, number>
  onSelect: (color: Color) => void
  /** Show each colour's letter, as on the stickers. */
  letters?: boolean
}

/** The six paint colours, each showing how many cells use it out of the 9 a real cube has. */
export function Palette({
  selected,
  counts,
  onSelect,
  letters = false,
}: PaletteProps) {
  return (
    <div className="palette" role="group" aria-label="Paint colour">
      {COLORS.map((color) => {
        const count = counts[color]
        const status =
          count > CELLS_PER_COLOR
            ? 'over'
            : count === CELLS_PER_COLOR
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
              {count}/{CELLS_PER_COLOR}
            </span>
          </button>
        )
      })}
    </div>
  )
}
