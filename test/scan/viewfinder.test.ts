import { describe, expect, it } from 'vitest'
import { shownPart, type Rect } from '../../src/scan/viewfinder.ts'

const expectClose = (actual: Rect, expected: Rect) => {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(actual[key], key).toBeCloseTo(expected[key])
  }
}

describe('shownPart', () => {
  it('just scales when the picture and the element are the same shape', () => {
    expect(
      shownPart(
        { x: 10, y: 20, width: 100, height: 50 },
        { width: 400, height: 300 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ x: 20, y: 40, width: 200, height: 100 })
  })

  it('leaves out the sides of a wide picture in a tall element', () => {
    // Scaled to fill the height, the 1280×720 picture is 1137.8 px wide,
    // so 388.9 px of it hang off each side of the 360 px wide element.
    expectClose(
      shownPart(
        { x: 0, y: 0, width: 360, height: 640 },
        { width: 360, height: 640 },
        { width: 1280, height: 720 },
      ),
      { x: 437.5, y: 0, width: 405, height: 720 },
    )
  })

  it('leaves out the top and bottom of a tall picture in a wide element', () => {
    expectClose(
      shownPart(
        { x: 0, y: 0, width: 400, height: 200 },
        { width: 400, height: 200 },
        { width: 720, height: 1280 },
      ),
      { x: 0, y: 460, width: 720, height: 360 },
    )
  })

  it('finds a guide centred on screen centred in the picture, and still square', () => {
    // An upright phone's viewfinder, with the guide 78% of its shorter side.
    const element = { width: 343, height: 358 }
    const side = 0.78 * 343
    const guide = {
      x: (element.width - side) / 2,
      y: (element.height - side) / 2,
      width: side,
      height: side,
    }
    const part = shownPart(guide, element, { width: 720, height: 1280 })
    expect(part.width).toBeCloseTo(part.height)
    expect(part.x + part.width / 2).toBeCloseTo(360)
    expect(part.y + part.height / 2).toBeCloseTo(640)
  })
})
