import { describe, expect, it, vi } from 'vitest'
import {
  classifyGesture,
  createGestureTracker,
  type Gesture,
  type PointerInput,
} from './gestures.ts'

const tap: Gesture = { type: 'tap' }
const none: Gesture = { type: 'none' }
const swipe = (direction: 'left' | 'right' | 'up' | 'down'): Gesture => ({
  type: 'swipe',
  direction,
})

describe('classifyGesture', () => {
  it.each<[string, number, number, Gesture]>([
    ['no movement', 0, 0, tap],
    ['a small wobble', 6, 6, tap],
    ['just under 10 px', 9.9, 0, tap],
    ['10 px: too far for a tap', 10, 0, none],
    ['29 px: too short for a swipe', 29, 0, none],
    ['30 px right', 30, 0, swipe('right')],
    ['30 px left', -30, 0, swipe('left')],
    ['30 px up (screen y grows downwards)', 0, -30, swipe('up')],
    ['30 px down', 0, 30, swipe('down')],
    ['a slightly slanted swipe right (31°)', 100, 60, swipe('right')],
    ['a slightly slanted swipe up', -60, -100, swipe('up')],
    ['too slanted (37°)', 100, 75, none],
    ['diagonal', 80, 80, none],
  ])('%s → %j', (_, dx, dy, expected) => {
    expect(classifyGesture(dx, dy)).toEqual(expected)
  })
})

describe('createGestureTracker', () => {
  const finger = (
    pointerId: number,
    clientX: number,
    clientY: number,
    extra: Partial<PointerInput> = {},
  ): PointerInput => ({
    pointerId,
    clientX,
    clientY,
    button: 0,
    isPrimary: pointerId === 1,
    ...extra,
  })

  const setup = () => {
    const onTap = vi.fn()
    const onSwipe = vi.fn()
    return { onTap, onSwipe, tracker: createGestureTracker({ onTap, onSwipe }) }
  }

  it('reports a tap where the finger went down, and never a swipe', () => {
    const { tracker, onTap, onSwipe } = setup()
    tracker.down(finger(1, 100, 100))
    tracker.up(finger(1, 104, 103))
    expect(onTap).toHaveBeenCalledWith(100, 100)
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('reports a swipe, and never a tap', () => {
    const { tracker, onTap, onSwipe } = setup()
    tracker.down(finger(1, 200, 200))
    tracker.up(finger(1, 120, 205))
    expect(onSwipe).toHaveBeenCalledWith('left')
    expect(onTap).not.toHaveBeenCalled()
  })

  it('does nothing for a movement between a tap and a swipe', () => {
    const { tracker, onTap, onSwipe } = setup()
    tracker.down(finger(1, 100, 100))
    tracker.up(finger(1, 120, 100))
    expect(onTap).not.toHaveBeenCalled()
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('cancels the gesture when a second finger touches down', () => {
    const { tracker, onTap, onSwipe } = setup()
    tracker.down(finger(1, 100, 100))
    tracker.down(finger(2, 300, 100))
    tracker.up(finger(2, 300, 100))
    tracker.up(finger(1, 20, 100))
    expect(onTap).not.toHaveBeenCalled()
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('ignores mouse buttons other than the main one', () => {
    const { tracker, onTap } = setup()
    tracker.down(finger(1, 100, 100, { button: 2 }))
    tracker.up(finger(1, 100, 100, { button: 2 }))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('forgets a finger the browser cancelled', () => {
    const { tracker, onTap } = setup()
    tracker.down(finger(1, 100, 100))
    tracker.cancel(finger(1, 100, 100))
    tracker.up(finger(1, 100, 100))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('recovers if a finger lift was never reported', () => {
    const { tracker, onTap } = setup()
    tracker.down(finger(1, 100, 100)) // lift lost
    tracker.down(finger(3, 50, 50, { isPrimary: true }))
    tracker.up(finger(3, 50, 50))
    expect(onTap).toHaveBeenCalledWith(50, 50)
  })
})
