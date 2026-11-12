import type { ReactNode } from 'react'
import type { Color } from '../cube/state.ts'
import { STICKER_COLORS } from '../view/colors.ts'
import type { Hold } from './hold.ts'
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
        <HoldInstruction hold={playback.hold} />
        <p className="solve-card-note">
          {/* A 2x2's corner is out of sight on the 3D cube: say what to compare. */}
          {playback.hold.by === 'corner' &&
            "Your cube's top, front and right should then look like the one on screen. "}
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
        <p>
          {moves.length === 1
            ? "That's the only move"
            : `That's all ${moves.length} moves`}
          : your cube is solved.
        </p>
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

/** Which way round to hold the cube: by its centres, or by the corner that never moves. */
function HoldInstruction({ hold }: { hold: Hold }) {
  if (hold.by === 'centres') {
    return (
      <p>
        Hold your cube with <ColorName color={hold.front} /> facing you and{' '}
        <ColorName color={hold.top} /> on top. Keep it this way for every step.
      </p>
    )
  }
  return (
    <p>
      Hold your cube so the corner at the back, bottom left has{' '}
      <ColorName color={hold.down} /> underneath,{' '}
      <ColorName color={hold.left} /> on the left and{' '}
      <ColorName color={hold.back} /> at the back. That corner never moves: keep
      your cube this way for every step.
    </p>
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
