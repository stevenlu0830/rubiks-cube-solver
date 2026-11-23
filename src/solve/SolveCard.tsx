import type { ReactNode } from 'react'
import { puzzleOf } from '../cube/puzzle.ts'
import {
  cellIndex,
  type Color,
  type CubeState,
  type Face,
} from '../cube/state.ts'
import type { StageName } from '../solver/protocol.ts'
import { STICKER_COLORS } from '../view/colors.ts'
import type { Hold } from './hold.ts'
import { describeMove } from './moveGuide.ts'
import {
  cubeAt,
  currentStep,
  finishedStage,
  isFinished,
  stageOf,
  type Playback,
} from './playback.ts'
import { STAGE_NAMES } from './stages.ts'

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
  const { moves, stages } = playback

  if (!playback.ready) {
    return (
      <section className="solve-card" aria-label="How to hold your cube">
        <HoldInstruction hold={playback.hold} />
        <p className="solve-card-note">
          {/* A 2x2's corner is out of sight on the 3D cube: say what to compare. */}
          {playback.hold.by === 'corner' &&
            "Your cube's top, front and right should then look like the one on screen. "}
          {stages.length > 1 &&
            `The ${moves.length} moves come in ${stages.length} stages, and Play stops after each for you to check your cube. `}
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
  const stage = stageOf(playback, step)
  const done = finishedStage(playback)
  return (
    <section className="solve-card solve-card-with-map" aria-live="polite">
      <div className="solve-card-body">
        {done && <Checkpoint stage={done.name} cube={cubeAt(playback)} />}
        <p className="solve-card-step">
          Step {step + 1} of {moves.length}
          {stage && ` · ${STAGE_NAMES[stage.name]}`}
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

/** Which way round to hold the cube: by its centres, by the corner that never moves, or by how it looks. */
function HoldInstruction({ hold }: { hold: Hold }) {
  if (hold.by === 'view') {
    return (
      <p>
        Hold your cube so its top, front and right look just like the one on
        screen. Keep it this way round for every step: nothing on a 4x4 stays
        put to show which way up it is until its centres are done, so don't turn
        the whole cube.
      </p>
    )
  }
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

/**
 * What the cube should look like at the end of a stage of a 4x4's
 * solution, and what to do if it doesn't: a point to recover from, rather
 * than finding out at the end.
 */
function Checkpoint({ stage, cube }: { stage: StageName; cube: CubeState }) {
  // Cell 5 is one of a 4x4 face's four centre squares (the only cube with stages).
  const centre = (face: Face) => cube[cellIndex(face, 5, puzzleOf(cube))]!
  return (
    <div className="solve-card-checkpoint">
      <p>
        <strong>{STAGE_NAMES[stage]} done.</strong>{' '}
        {stage === 'centres' ? (
          <>
            Each centre should now be one colour:{' '}
            <ColorName color={centre('U')} /> on top,{' '}
            <ColorName color={centre('F')} /> in front. They won't move from
            here.
          </>
        ) : stage === 'edges' ? (
          "Each edge's two pieces should now match, side by side, and the centres still be whole."
        ) : (
          'The centres and edge pairs should still be whole. The rest is solved like a 3x3.'
        )}
      </p>
      <p className="solve-card-note">
        If yours doesn't match, tap ‹ Edit cube, paint your cube as it is now,
        and Solve again.
      </p>
    </div>
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
