import { afterEach, describe, expect, it, vi } from 'vitest'
import { buzz, canVibrate } from './haptics.ts'

describe('haptics', () => {
  afterEach(() => {
    // @ts-expect-error: removing the stand-in added below
    delete navigator.vibrate
  })

  it('does nothing on browsers that cannot vibrate, like Safari on iPhone', () => {
    expect(canVibrate()).toBe(false)
    expect(() => buzz('tap')).not.toThrow()
  })

  it('vibrates where the browser can', () => {
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrate,
      configurable: true,
    })
    expect(canVibrate()).toBe(true)
    buzz('tap')
    buzz('solved')
    expect(vibrate).toHaveBeenNthCalledWith(1, 10)
    expect(vibrate).toHaveBeenNthCalledWith(2, [30, 50, 30, 50, 90])
  })
})
