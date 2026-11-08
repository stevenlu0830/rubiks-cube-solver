import { describe, expect, it } from 'vitest'
import { chroma, rgbToLab, type Lab, type Rgb } from './colorSpace.ts'

const expectLab = (actual: Lab, expected: Lab) => {
  for (const key of ['l', 'a', 'b'] as const) {
    expect(actual[key], key).toBeCloseTo(expected[key], 1)
  }
}

describe('rgbToLab', () => {
  // Published values for sRGB colours under daylight (D65) white.
  it.each<[string, Rgb, Lab]>([
    ['white', [255, 255, 255], { l: 100, a: 0, b: 0 }],
    ['black', [0, 0, 0], { l: 0, a: 0, b: 0 }],
    ['mid grey', [128, 128, 128], { l: 53.59, a: 0, b: 0 }],
    ['red', [255, 0, 0], { l: 53.24, a: 80.09, b: 67.2 }],
    ['green', [0, 255, 0], { l: 87.73, a: -86.18, b: 83.18 }],
    ['blue', [0, 0, 255], { l: 32.3, a: 79.19, b: -107.86 }],
    ['yellow', [255, 255, 0], { l: 97.14, a: -21.55, b: 94.48 }],
    ['very dark grey', [5, 5, 5], { l: 1.37, a: 0, b: 0 }],
  ])('converts %s', (_, rgb, lab) => {
    expectLab(rgbToLab(rgb), lab)
  })
})

describe('chroma', () => {
  it('is 0 for greys and large for vivid colours', () => {
    expect(chroma(rgbToLab([90, 90, 90]))).toBeCloseTo(0)
    expect(chroma(rgbToLab([255, 0, 0]))).toBeCloseTo(104.55, 1)
  })
})
