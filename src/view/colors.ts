import type { Color } from '../cube/state.ts'

/** Standard Rubik's brand colours, shared by the 3D stickers and the palette. */
export const STICKER_COLORS: Record<Color, string> = {
  white: '#ffffff',
  yellow: '#ffd500',
  green: '#009b48',
  blue: '#0046ad',
  red: '#b71234',
  orange: '#ff5800',
}

/**
 * Letters that can be shown on the stickers, so people who find some
 * colours hard to tell apart (colour blindness) can read them instead.
 */
export const COLOR_LETTERS: Record<Color, string> = {
  white: 'W',
  yellow: 'Y',
  green: 'G',
  blue: 'B',
  red: 'R',
  orange: 'O',
}

/**
 * How easy text in one colour is to read on another, from 1 (identical) to
 * 21 (black on white), as defined by the web accessibility guidelines (WCAG).
 * Normal text needs at least 4.5.
 */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** How bright a #rrggbb colour looks, from 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Black or white, whichever is easier to read on that sticker colour. */
export const LETTER_INK = Object.fromEntries(
  Object.entries(STICKER_COLORS).map(([color, hex]) => [
    color,
    contrastRatio(hex, '#000000') >= contrastRatio(hex, '#ffffff')
      ? '#000000'
      : '#ffffff',
  ]),
) as Record<Color, string>
