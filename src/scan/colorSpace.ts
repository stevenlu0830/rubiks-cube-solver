/**
 * Colour maths for reading the camera's picture.
 *
 * Cameras give each colour as RGB: how much red, green and blue light there
 * is. That's how screens make colours, not how eyes compare them: two pairs
 * of colours the same RGB distance apart can look almost the same, or
 * completely different. Lab is a standard colour space built so that
 * distances match what people see:
 *
 * - L is lightness, from 0 (black) to 100 (white).
 * - a runs from green (negative) to red (positive).
 * - b runs from blue (negative) to yellow (positive).
 *
 * Greys and whites sit near a = b = 0. The further a colour is from there,
 * the more vivid it is (its chroma), and the direction it lies in is its hue.
 */

/** A colour as the camera gives it: red, green and blue, each 0–255. */
export type Rgb = readonly [red: number, green: number, blue: number]

export interface Lab {
  /** Lightness, 0 (black) to 100 (white). */
  l: number
  /** Green (negative) to red (positive). */
  a: number
  /** Blue (negative) to yellow (positive). */
  b: number
}

export function rgbToLab([red, green, blue]: Rgb): Lab {
  // 1. Undo the brightness curve stored in RGB numbers (the sRGB "gamma"),
  //    to get the actual amount of light in each channel, 0 to 1.
  const [r, g, b] = [red, green, blue].map(toLinear)
  // 2. Mix those into XYZ, the standard measure of colour that Lab is built
  //    on, scaled so that white comes out as 1, 1, 1.
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883
  // 3. Eyes notice small changes in dark colours more than in bright ones,
  //    so squash each one about the way eyes do, then take differences.
  const [fx, fy, fz] = [x, y, z].map(perceived)
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

/** How vivid a colour is: 0 for greys and white, up to about 130. */
export function chroma({ a, b }: Lab): number {
  return Math.hypot(a, b)
}

function toLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

// Roughly a cube root, with a straight line near black where the cube root
// would be too steep. The constants come from the Lab standard.
function perceived(t: number): number {
  return t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116
}
