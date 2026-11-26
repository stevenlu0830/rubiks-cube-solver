import { useEffect, useId, useRef } from 'react'
import { describeMove } from './moveGuide.ts'
import { currentStep, type Playback } from './playback.ts'
import { STAGE_NAMES } from './stages.ts'

interface StepListProps {
  playback: Playback
  onJump: (step: number) => void
}

/**
 * Every move of the solution, under a heading for each stage if it has
 * stages (a 4x4's or 5x5's). Tapping one jumps the cube to just before it.
 */
export function StepList({ playback, onJump }: StepListProps) {
  const { moves, ready, stages } = playback
  const step = currentStep(playback)
  const list = useRef<HTMLOListElement>(null)
  const id = useId()

  /** The steps from `start` up to (not including) `end`, numbered from 1 for the whole solution. */
  const steps = (start: number, end: number) =>
    moves.slice(start, end).map((move, offset) => {
      const i = start + offset
      return (
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
      )
    })

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
    <ol
      className="step-list"
      aria-label="Steps"
      ref={list}
      // Lets keyboard users scroll the list even while its steps are disabled.
      tabIndex={0}
    >
      {stages.length === 0
        ? steps(0, moves.length)
        : stages.map(({ name, start }, k) => (
            <li key={name} className="step-stage">
              <h2 className="step-stage-name" id={`${id}-${name}`}>
                {STAGE_NAMES[name]}
              </h2>
              <ol aria-labelledby={`${id}-${name}`}>
                {steps(start, stages[k + 1]?.start ?? moves.length)}
              </ol>
            </li>
          ))}
    </ol>
  )
}
