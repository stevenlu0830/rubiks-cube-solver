import { COLORS, type Color } from '../cube/state.ts'
import { STICKER_COLORS } from '../view/colors.ts'
import { CELLS_PER_COLOR } from './editor.ts'
import './Palette.css'

interface PaletteProps {
  selected: Color
  counts: Record<Color, number>
  onSelect: (color: Color) => void
}

/** The six paint colours, each showing how many cells use it out of the 9 a real cube has. */
export function Palette({ selected, counts, onSelect }: PaletteProps) {
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
            aria-label={`${color}, ${count} of ${CELLS_PER_COLOR}`}
            onClick={() => onSelect(color)}
          >
            <span
              className="swatch-chip"
              style={{ background: STICKER_COLORS[color] }}
            />
            <span className="swatch-count" data-status={status}>
              {count}/{CELLS_PER_COLOR}
            </span>
          </button>
        )
      })}
    </div>
  )
}
