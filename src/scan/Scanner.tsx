import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  CameraError,
  cameraErrorMessage,
  openCamera,
  stopCamera,
} from './camera.ts'
import './scan.css'

/**
 * The top of the scan screen: what the camera sees, with a 3×3 grid to line
 * one side of the cube up in. The camera is on only while this is shown and
 * the app is on screen.
 */
export function Scanner() {
  const visible = usePageVisible()
  // Try again bumps this: a new key starts a new CameraView, so a fresh camera.
  const [attempt, setAttempt] = useState(0)
  return (
    <section className="scanner" aria-label="Scan your cube">
      <div className="viewfinder">
        {/* Off while the app is in the background: saves battery, and frees the camera for other apps. */}
        {visible && (
          <CameraView key={attempt} onRetry={() => setAttempt((n) => n + 1)} />
        )}
      </div>
      <p className="hint">
        Hold your cube up to the camera so one side fills the grid.
      </p>
    </section>
  )
}

type CameraState =
  | { status: 'starting' }
  | { status: 'on' }
  | { status: 'failed'; message: string }

/** Starts the camera when shown and stops it when removed, whatever happens in between. */
function CameraView({ onRetry }: { onRetry: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<CameraState>({ status: 'starting' })

  useEffect(() => {
    const element = video.current!
    let stream: MediaStream | null = null
    let closed = false
    const fail = (error: unknown) => {
      if (!closed) {
        setCamera({ status: 'failed', message: cameraErrorMessage(error) })
      }
    }
    openCamera().then((opened) => {
      // Closed while the browser was still asking for permission: switch it straight off.
      if (closed) {
        stopCamera(opened)
        return
      }
      stream = opened
      element.srcObject = opened
      opened
        .getVideoTracks()[0]
        ?.addEventListener('ended', () => fail(new CameraError('stopped')))
      setCamera({ status: 'on' })
    }, fail)
    return () => {
      closed = true
      element.srcObject = null
      if (stream) stopCamera(stream)
    }
  }, [])

  return (
    <>
      {/* playsInline and muted: without them, iPhones play camera video full screen, or not at all. */}
      <video ref={video} autoPlay playsInline muted />
      {camera.status === 'on' && (
        <div className="scan-guide" aria-hidden="true">
          {Array.from({ length: 9 }, (_, n) => (
            <span key={n} />
          ))}
        </div>
      )}
      {camera.status === 'starting' && (
        <p className="viewfinder-message" role="status">
          Starting the camera… If your browser asks, allow it.
        </p>
      )}
      {camera.status === 'failed' && (
        <div className="viewfinder-message" role="alert">
          <p>{camera.message}</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
    </>
  )
}

/** A camera, for the Scan button. */
export function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M3 9a2 2 0 0 1 2-2h2.5l1.5-2.5h6L16.5 7H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <circle cx="12" cy="13" r="3.5" />
      </g>
    </svg>
  )
}

/** True while the app is on screen; false when switched away from, or the phone is locked. */
function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeToVisibility, () => !document.hidden)
}

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}
