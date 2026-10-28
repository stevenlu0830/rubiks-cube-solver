/**
 * Short buzzes from the phone, so a tap or a result can be felt as well as
 * seen. Only some browsers can do this: Chrome on Android can, Safari on
 * iPhone can't. Elsewhere it's silently skipped.
 */

/** Each buzz: milliseconds on, off, on… */
const PATTERNS = {
  /** A square painted or cleared: one tiny tick. */
  tap: 10,
  /** The cube failed a check: two short knocks. */
  problem: [40, 60, 40],
  /** The cube is solved: a little drum roll. */
  solved: [30, 50, 30, 50, 90],
} satisfies Record<string, VibratePattern>

export type Buzz = keyof typeof PATTERNS

/** True if this browser can buzz the phone. */
export function canVibrate(): boolean {
  return 'vibrate' in navigator
}

export function buzz(kind: Buzz): void {
  if (canVibrate()) navigator.vibrate(PATTERNS[kind])
}
