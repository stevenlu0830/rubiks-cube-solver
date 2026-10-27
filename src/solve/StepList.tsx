import { useEffect, useRef } from 'react'
import { describeMove } from './moveGuide.ts'
import { currentStep, type Playback } from './playback.ts'

interface StepListProps {
  playback: Playback
  onJump: (step: number) => void
}

/** Every move of the solution. Tapping one jumps the cube to just before it. */
export function StepList({ playback, onJump }: StepListProps) {
  const { moves, ready } = playback
  const step = currentStep(playback)
  const list = useRef<HTMLOListElement>(null)

  // Keep the current step in view. Scrolling only the list (not with
  // scrollIntoView) stops the whole page from shifting on phones.
  useEffect(() => {
    const container = list.current
    const current = container?.querySelector<HTMLElement>(
      '[aria-current="step"]',
    )
    if (!container || !current) return
    const top = current.offsetTop
    const bottom = top + current.offsetHeight
    if (top < container.scrollTop) container.scrollTop = top
    else if (bottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = bottom - container.clientHeight
    }
  }, [step])

  return (
    <ol className="step-list" aria-label="Steps" ref={list}>
      {moves.map((move, i) => (
        <li key={i}>
          <button
            type="button"
            aria-current={i === step ? 'step' : undefined}
            data-done={i < step || undefined}
            disabled={!ready}
            onClick={() => onJump(i)}
          >
            <span className="step-number">{i + 1}</span>
            <span className="move-notation">{move}</span>
            <span className="step-text">{describeMove(move)}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}
