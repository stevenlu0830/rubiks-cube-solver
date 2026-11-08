import { Matrix4, Quaternion } from 'three'
import type { SwipeDirection } from '../view/gestures.ts'
import { turnBySwipe } from '../view/orientation.ts'

const SWIPES: SwipeDirection[] = ['left', 'right', 'up', 'down']

/** Every orientation swipes can reach (all 24), found by trying every swipe from each. */
export function allOrientations(): Quaternion[] {
  const key = (q: Quaternion) =>
    new Matrix4().makeRotationFromQuaternion(q).elements.map(Math.round).join()
  const seen = new Map([[key(new Quaternion()), new Quaternion()]])
  const queue = [new Quaternion()]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const direction of SWIPES) {
      const next = turnBySwipe(current, direction)
      if (!seen.has(key(next))) {
        seen.set(key(next), next)
        queue.push(next)
      }
    }
  }
  return [...seen.values()]
}
