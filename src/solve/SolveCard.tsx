import type { ReactNode } from 'react'
import type { Color } from '../cube/state.ts'
import { STICKER_COLORS } from '../view/colors.ts'
import { describeMove } from './moveGuide.ts'
import { currentStep, isFinished, type Playback } from './playback.ts'

interface SolveCardProps {
  playback: Playback
  onReady: () => void
  onWatchAgain: () => void
  onSolveAnother: () => void
  /** Shown beside each step: a map of all six faces. */
  map?: ReactNode
}

/** The top of the solve screen: how to hold the cube, the current step, or "Solved". */
export function SolveCard({
  playback,
  onReady,
  onWatchAgain,
  onSolveAnother,
  map,
}: SolveCardProps) {
  const { moves } = playback

  if (!playback.ready) {
    return (
      <section className="solve-card" aria-label="How to hold your cube">
        <p>
          Hold your cube with <ColorName color={playback.front} /> facing you
          and <ColorName color={playback.top} /> on top. Keep it this way for
          every step.
        </p>
        <p className="solve-card-note">
          “Clockwise” means as if you were looking straight at that face.
        </p>
        <button type="button" className="primary-button" onClick={onReady}>
          I'm ready
        </button>
      </section>
    )
  }

  if (isFinished(playback)) {
    return (
      <section className="solve-card solve-card-done">
        <h2>Solved 🎉</h2>
        <p>That's all {moves.length} moves: your cube is solved.</p>
        <div className="solve-card-actions">
          <button type="button" onClick={onWatchAgain}>
            Watch again
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onSolveAnother}
          >
            Solve another cube
          </button>
        </div>
      </section>
    )
  }

  const step = currentStep(playback)
  const move = moves[step]
  return (
    <section className="solve-card solve-card-with-map" aria-live="polite">
      <div className="solve-card-body">
        <p className="solve-card-step">
          Step {step + 1} of {moves.length}
        </p>
        <p className="solve-card-move">
          <span className="move-notation">{move}</span>
          <span>{describeMove(move)}</span>
        </p>
      </div>
      {map}
    </section>
  )
}

function ColorName({ color }: { color: Color }) {
  return (
    <strong className="color-name">
      <span
        className="color-chip"
        style={{ background: STICKER_COLORS[color] }}
      />
      {color}
    </strong>
  )
}
