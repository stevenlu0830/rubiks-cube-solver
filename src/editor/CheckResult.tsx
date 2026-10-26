import type { Validation } from '../cube/validate.ts'
import './CheckResult.css'

interface CheckResultProps {
  result: Validation
  onClose: () => void
}

/** The outcome of checking the painted cube, shown after Solve is pressed. */
export function CheckResult({ result, onClose }: CheckResultProps) {
  return (
    <div
      className="check-result"
      data-tone={result.valid ? 'ok' : 'problem'}
      role="status"
    >
      <p>
        {result.valid
          ? result.solved
            ? 'This cube is already solved!'
            : 'Looks good: this is a real, solvable cube.'
          : result.message}
        {!result.valid && result.cells.length > 0 && (
          <span className="check-result-tip">
            {' '}
            The squares to check are outlined in pink; swipe to see every side.
          </span>
        )}
      </p>
      <button type="button" aria-label="Dismiss" onClick={onClose}>
        ×
      </button>
    </div>
  )
}
