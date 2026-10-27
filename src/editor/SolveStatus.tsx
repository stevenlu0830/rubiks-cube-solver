import { formatMoves, type Move } from '../cube/moves.ts'
import type { Color } from '../cube/state.ts'
import type { Validation } from '../cube/validate.ts'
import './SolveStatus.css'

/** How far pressing Solve has got. */
export type SolveStage =
  /** The cube failed a check, or is already solved, so there's nothing to solve. */
  | { stage: 'checked'; validation: Validation }
  /** Waiting for the solver; `starting` if it's still doing its one-off setup. */
  | { stage: 'solving'; starting: boolean }
  /** The answer, for the cube held with `front` facing the user and `top` on top. */
  | { stage: 'solved'; moves: Move[]; front: Color; top: Color }
  | { stage: 'failed'; message: string }

interface SolveStatusProps {
  status: SolveStage
  onClose: () => void
}

/** The message shown after Solve is pressed, in place of the painting hint. */
export function SolveStatus({ status, onClose }: SolveStatusProps) {
  const tone =
    status.stage === 'solving'
      ? 'info'
      : status.stage === 'failed' ||
          (status.stage === 'checked' && !status.validation.valid)
        ? 'problem'
        : 'ok'

  return (
    <div className="solve-status" data-tone={tone} role="status">
      <div className="solve-status-body">
        <StageMessage status={status} />
      </div>
      {status.stage !== 'solving' && (
        <button type="button" aria-label="Dismiss" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  )
}

function StageMessage({ status }: { status: SolveStage }) {
  switch (status.stage) {
    case 'checked': {
      const { validation } = status
      if (validation.valid) {
        return (
          <p>
            {validation.solved
              ? 'This cube is already solved!'
              : 'Looks good: this is a real, solvable cube.'}
          </p>
        )
      }
      return (
        <p>
          {validation.message}
          {validation.cells.length > 0 && (
            <span className="solve-status-tip">
              {' '}
              The squares to check are outlined in pink; swipe to see every
              side.
            </span>
          )}
        </p>
      )
    }
    case 'solving':
      return (
        <p>
          {status.starting
            ? 'Getting the solver ready (only needed once)…'
            : 'Finding a solution…'}
        </p>
      )
    case 'solved':
      return (
        <>
          <p>
            Hold your cube with <strong>{status.front}</strong> facing you and{' '}
            <strong>{status.top}</strong> on top, then turn:
          </p>
          <p className="solve-status-moves">{formatMoves(status.moves)}</p>
          <p className="solve-status-tip">{status.moves.length} moves</p>
        </>
      )
    case 'failed':
      return <p>{status.message}</p>
  }
}
