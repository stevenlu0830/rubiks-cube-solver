import { formatMoves, type Move } from '../cube/moves.ts'
import type { Validation } from '../cube/validate.ts'
import type { Stage, StageName } from '../solver/protocol.ts'
import './SolveStatus.css'

/** How far pressing Solve has got, short of a solution (which opens the solve screen). */
export type SolveStage =
  /** The cube failed a check, or is already solved, so there's nothing to solve. */
  | { stage: 'checked'; validation: Validation }
  /** Waiting for the solver; `starting` if it's still doing its one-off setup. */
  | { stage: 'solving'; starting: boolean }
  | { stage: 'failed'; message: string }
  /**
   * A 4x4's solution, listed as moves, stage by stage: step-by-step help
   * with the 3D cube isn't ready for a 4x4 yet.
   */
  | { stage: 'found'; moves: readonly Move[]; stages: readonly Stage[] }

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
    case 'failed':
      return <p>{status.message}</p>
    case 'found':
      return <FoundSolution moves={status.moves} stages={status.stages} />
  }
}

const STAGE_NAMES: Record<StageName, string> = {
  centres: 'Centres',
  edges: 'Pair the edges',
  parity: 'Parity fix',
  finish: 'Finish like a 3x3',
}

const moveCount = (count: number) =>
  `${count} ${count === 1 ? 'move' : 'moves'}`

/** A solution's moves, in a list of its stages that scrolls if it's long. */
function FoundSolution({
  moves,
  stages,
}: {
  moves: readonly Move[]
  stages: readonly Stage[]
}) {
  return (
    <>
      <p>
        A solution in {moveCount(moves.length)}
        {stages.length > 1 && `, in ${stages.length} stages`}:
      </p>
      <ol className="solution-stages" tabIndex={0} aria-label="Solution">
        {stages.map(({ name, start }, i) => {
          const stageMoves = moves.slice(start, stages[i + 1]?.start)
          return (
            <li key={name}>
              <span className="solution-stage-name">
                {STAGE_NAMES[name]} ({moveCount(stageMoves.length)}):
              </span>{' '}
              <span className="move-notation">{formatMoves(stageMoves)}</span>
            </li>
          )
        })}
      </ol>
      <p>
        Hold your cube as shown, and keep it that way round until it's solved.
        R, U, F, L, D and B turn the right, top, front, left, bottom and back
        faces clockwise, as if you were looking straight at that face; R' is
        anticlockwise and R2 a half turn. Rw turns the right face and the layer
        behind it together, and r turns only that inner layer, the same way as
        R. Step-by-step help for the 4x4 is coming soon.
      </p>
    </>
  )
}
