import { useState } from 'react'
import {
  clearRecordedScans,
  LIGHTS,
  loadRecordedScans,
  type Light,
} from './scanDebug.ts'

interface ScanDebugPanelProps {
  light: Light
  onLight: (light: Light) => void
}

/**
 * Shown on the scan screen in ?scan-debug mode only: what light the photos
 * are in, and ways to get the recorded scans off the phone.
 */
export function ScanDebugPanel({ light, onLight }: ScanDebugPanelProps) {
  const [message, setMessage] = useState('')
  const scans = loadRecordedScans()
  const data = () => JSON.stringify(scans, null, 1)

  function download() {
    const url = URL.createObjectURL(
      new Blob([data()], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `scan-photos-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function copy() {
    Promise.resolve(navigator.clipboard?.writeText(data())).then(
      () => setMessage('Copied.'),
      () => setMessage("Couldn't copy: try Download."),
    )
  }

  function clear() {
    clearRecordedScans()
    setMessage('Cleared.')
  }

  return (
    <section className="scan-debug" aria-label="Scan debug">
      <label>
        Light{' '}
        <select
          value={light}
          onChange={(event) => onLight(event.target.value as Light)}
        >
          {LIGHTS.map((choice) => (
            <option key={choice}>{choice}</option>
          ))}
        </select>
      </label>
      <span>
        {scans.length} {scans.length === 1 ? 'scan' : 'scans'} saved
      </span>
      <button type="button" onClick={download} disabled={!scans.length}>
        Download
      </button>
      <button type="button" onClick={copy} disabled={!scans.length}>
        Copy
      </button>
      <button type="button" onClick={clear} disabled={!scans.length}>
        Clear
      </button>
      <span role="status">{message}</span>
    </section>
  )
}
