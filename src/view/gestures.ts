/**
 * Tells taps from swipes. Both start with a finger going down on the cube,
 * so the only difference is how far, and which way, it moved before lifting:
 *
 *   under 10 px              → tap (paint a square)
 *   10–30 px                 → nothing: too far for a tap, too short for a swipe
 *   30 px or more, roughly
 *   straight in one direction → swipe (turn the cube)
 *   30 px or more, diagonal  → nothing
 *
 * The gap between the tap and swipe distances means a sloppy tap can never
 * turn the cube, and a short swipe can never paint.
 */

/** A finger may move less than this (CSS pixels) and still count as a tap. */
export const TAP_SLOP = 10
/** A finger must move at least this far (CSS pixels) to count as a swipe. */
export const SWIPE_MIN_DISTANCE = 30
/** A swipe may stray this many degrees from straight left/right/up/down. */
export const SWIPE_MAX_ANGLE = 35

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

export type Gesture =
  | { type: 'tap' }
  | { type: 'swipe'; direction: SwipeDirection }
  | { type: 'none' }

const MAX_SIDEWAYS_RATIO = Math.tan((SWIPE_MAX_ANGLE * Math.PI) / 180)

/** Classifies a finger movement. Screen y grows downwards, so negative dy is up. */
export function classifyGesture(dx: number, dy: number): Gesture {
  const distance = Math.hypot(dx, dy)
  if (distance < TAP_SLOP) return { type: 'tap' }
  if (distance < SWIPE_MIN_DISTANCE) return { type: 'none' }
  if (Math.abs(dy) <= Math.abs(dx) * MAX_SIDEWAYS_RATIO) {
    return { type: 'swipe', direction: dx < 0 ? 'left' : 'right' }
  }
  if (Math.abs(dx) <= Math.abs(dy) * MAX_SIDEWAYS_RATIO) {
    return { type: 'swipe', direction: dy < 0 ? 'up' : 'down' }
  }
  return { type: 'none' }
}

/** The parts of a browser PointerEvent the tracker needs. */
export interface PointerInput {
  pointerId: number
  clientX: number
  clientY: number
  /** 0 = main mouse button or a finger; other buttons are ignored. */
  button: number
  /** True for a mouse, or the first finger of a new touch. */
  isPrimary: boolean
}

export interface GestureCallbacks {
  /** A tap, at the screen position where the finger went down. */
  onTap: (clientX: number, clientY: number) => void
  onSwipe: (direction: SwipeDirection) => void
}

/**
 * Follows one finger from going down to lifting, then reports a tap or a
 * swipe. A second finger touching down cancels the gesture, so pinches and
 * accidental two-finger touches do nothing.
 */
export function createGestureTracker({ onTap, onSwipe }: GestureCallbacks) {
  const fingersDown = new Set<number>()
  let start: { pointerId: number; x: number; y: number } | null = null

  return {
    down(event: PointerInput) {
      // A primary pointer means no other finger is down, even if a lift was missed.
      if (event.isPrimary) fingersDown.clear()
      fingersDown.add(event.pointerId)
      start =
        fingersDown.size === 1 && event.button === 0
          ? { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
          : null
    },
    up(event: PointerInput) {
      fingersDown.delete(event.pointerId)
      if (start?.pointerId !== event.pointerId) return
      const { x, y } = start
      start = null
      const gesture = classifyGesture(event.clientX - x, event.clientY - y)
      if (gesture.type === 'tap') onTap(x, y)
      if (gesture.type === 'swipe') onSwipe(gesture.direction)
    },
    /** The browser took the touch away (e.g. a system gesture): forget it. */
    cancel(event: PointerInput) {
      fingersDown.delete(event.pointerId)
      if (start?.pointerId === event.pointerId) start = null
    },
  }
}
