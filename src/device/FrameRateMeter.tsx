import { useEffect, useState } from 'react'
import './FrameRateMeter.css'

/** How often the readout updates (ms). */
const WINDOW = 500

/**
 * A tiny frame-rate readout in the corner, for checking that turns animate
 * smoothly on a real phone (main.tsx shows it when the address ends in
 * ?fps). Smooth means about 60 frames a second, or the screen's own rate
 * (some phones run at 120), and no frame much slower than 1000 ÷ that rate:
 * 17 ms at 60.
 */
export function FrameRateMeter() {
  const [reading, setReading] = useState<{ fps: number; slowest: number }>()

  useEffect(() => {
    let request = 0
    let last = performance.now()
    let windowStart = last
    let frames = 0
    let slowest = 0
    const frame = (now: number) => {
      frames++
      slowest = Math.max(slowest, now - last)
      last = now
      if (now - windowStart >= WINDOW) {
        setReading({ fps: (frames * 1000) / (now - windowStart), slowest })
        windowStart = now
        frames = 0
        slowest = 0
      }
      request = requestAnimationFrame(frame)
    }
    request = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(request)
  }, [])

  return (
    <output className="frame-rate" aria-label="Frame rate">
      {reading
        ? `${Math.round(reading.fps)} fps · slowest ${Math.round(reading.slowest)} ms`
        : '… fps'}
    </output>
  )
}
