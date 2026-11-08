import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from 'react'
import type { Quaternion } from 'three'
import { FACES, type Color, type CubeState } from '../cube/state.ts'
import { CubeNet } from '../solve/CubeNet.tsx'
import { STICKER_COLORS } from '../view/colors.ts'
import type { SwipeDirection } from '../view/gestures.ts'
import {
  cubeAsShown,
  frontCells,
  frontFace,
  turnBySwipe,
} from '../view/orientation.ts'
import {
  CameraError,
  cameraErrorMessage,
  openCamera,
  stopCamera,
} from './camera.ts'
import { rgbToLab, type Rgb } from './colorSpace.ts'
import { grabFrame, readSquares } from './sample.ts'
import {
  nextSideTurns,
  sideColors,
  turnInstruction,
  type ScannedSides,
} from './sides.ts'
import './scan.css'

interface ScannerProps {
  /** The painted cube, for the map of all six sides. */
  cube: CubeState
  /** Which way round the 3D cube is shown: its front is the side to photograph. */
  orientation: Quaternion
  /** Turns the 3D cube, for Next side. */
  onTurn: (orientation: Quaternion) => void
  /** Paints a side read from a photo, as [cell, colour] pairs. */
  onPaint: (paints: [number, Color][]) => void
  /** Back to painting, once all six sides are in. */
  onDone: () => void
}

/**
 * The scan screen, above the 3D cube: what the camera sees, with a 3×3 grid
 * to line one side up in, and the buttons to photograph each side in turn.
 * The camera is on only while this is shown and the app is on screen.
 */
export function Scanner({
  cube,
  orientation,
  onTurn,
  onPaint,
  onDone,
}: ScannerProps) {
  const visible = usePageVisible()
  // Try again bumps this: a new key starts a new CameraView, so a fresh camera.
  const [attempt, setAttempt] = useState(0)
  const camera = useRef<CameraHandle>(null)
  const [live, setLive] = useState(false)
  const [sides, setSides] = useState<ScannedSides>({})
  /** The last photo's colours, while it's shown. Turning the cube moves on from it. */
  const [photo, setPhoto] = useState<{
    colors: Color[]
    orientation: Quaternion
  } | null>(null)
  /** The last time Next side turned the cube, to say how to turn the real one. */
  const [turn, setTurn] = useState<{
    to: Quaternion
    swipes: SwipeDirection[]
  } | null>(null)

  const front = frontFace(orientation)
  const scanned = new Set(FACES.filter((face) => sides[face]))
  const allScanned = scanned.size === FACES.length
  const shownPhoto = photo?.orientation === orientation ? photo.colors : null

  function takePhoto() {
    const squares = camera.current?.read()
    if (!squares) return // no picture yet
    const read = { ...sides, [front]: squares.map(rgbToLab) }
    const colors = sideColors(read, front)
    setSides(read)
    setPhoto({ colors, orientation })
    onPaint(frontCells(orientation).map((cell, n) => [cell, colors[n]]))
  }

  function nextSide() {
    setPhoto(null)
    const swipes = nextSideTurns(orientation, scanned)
    if (!swipes || swipes.length === 0) return
    const to = swipes.reduce(turnBySwipe, orientation)
    setTurn({ to, swipes })
    onTurn(to)
  }

  function instruction(): string {
    if (shownPhoto) {
      return allScanned
        ? 'All six sides are in. Tap Done, then check the cube and tap Solve.'
        : 'Check the colours on the cube below. If one is wrong, retake the photo.'
    }
    if (scanned.size === 0) {
      return 'Hold any side of your cube up to the camera so it fills the grid, then take a photo.'
    }
    if (scanned.has(front)) {
      return allScanned
        ? 'All six sides are in. Take another photo to replace this side, or tap Done.'
        : 'This side is done. Take another photo to replace it, or go to the next side.'
    }
    if (turn?.to === orientation) {
      return `${turnInstruction(turn.swipes)}, then take a photo.`
    }
    return 'Turn your cube the same way as the one below, so the outlined side faces you, then take a photo.'
  }

  const goOn = allScanned ? (
    <button type="button" className="scan-primary" onClick={onDone}>
      Done
    </button>
  ) : (
    <button type="button" className="scan-primary" onClick={nextSide}>
      Next side ›
    </button>
  )

  return (
    <section className="scanner" aria-label="Scan your cube">
      <div className="viewfinder">
        {/* Off while the app is in the background: saves battery, and frees the camera for other apps. */}
        {visible && (
          <CameraView
            key={attempt}
            ref={camera}
            photo={shownPhoto}
            onLive={setLive}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        )}
      </div>
      <div className="scan-actions">
        {shownPhoto ? (
          <>
            <button type="button" onClick={() => setPhoto(null)}>
              Retake
            </button>
            {goOn}
          </>
        ) : (
          <>
            {/* Back on a side already scanned: move on without a new photo. */}
            {scanned.has(front) && (
              <button type="button" onClick={allScanned ? onDone : nextSide}>
                {allScanned ? 'Done' : 'Next side ›'}
              </button>
            )}
            <button
              type="button"
              className="scan-primary"
              onClick={takePhoto}
              disabled={!live}
            >
              <CameraIcon />
              Take photo
            </button>
          </>
        )}
      </div>
      <div className="scan-progress">
        <CubeNet state={cubeAsShown(cube, orientation)} activeFace="F" />
        <div>
          <p className="scan-count">
            {scanned.size} of {FACES.length} sides
          </p>
          <p className="scan-instruction" aria-live="polite">
            {instruction()}
          </p>
        </div>
      </div>
    </section>
  )
}

type CameraState =
  | { status: 'starting' }
  | { status: 'on' }
  | { status: 'failed'; message: string }

interface CameraHandle {
  /** The colour of each of the 9 squares in the guide right now, or null with no picture yet. */
  read: () => Rgb[] | null
}

interface CameraViewProps {
  ref: Ref<CameraHandle>
  /** The colours read from a photo: the picture holds still, with them on top. */
  photo: readonly Color[] | null
  /** Told true once the camera's picture is showing, and false when it stops. */
  onLive: (live: boolean) => void
  onRetry: () => void
}

/** Starts the camera when shown and stops it when removed, whatever happens in between. */
function CameraView({ ref, photo, onLive, onRetry }: CameraViewProps) {
  const video = useRef<HTMLVideoElement>(null)
  const guide = useRef<HTMLDivElement>(null)
  const [camera, setCamera] = useState<CameraState>({ status: 'starting' })
  const frozen = photo !== null
  const reportLive = useEffectEvent((isLive: boolean) => onLive(isLive))

  useImperativeHandle(ref, () => ({
    read() {
      const pixels =
        video.current && guide.current
          ? grabFrame(video.current, guide.current)
          : null
      return pixels && readSquares(pixels)
    },
  }))

  useEffect(() => {
    const element = video.current!
    let stream: MediaStream | null = null
    let closed = false
    const fail = (error: unknown) => {
      if (closed) return
      setCamera({ status: 'failed', message: cameraErrorMessage(error) })
      reportLive(false)
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
      reportLive(true)
    }, fail)
    return () => {
      closed = true
      element.srcObject = null
      if (stream) stopCamera(stream)
      reportLive(false)
    }
  }, [])

  // A photo holds the picture still; Retake or Next side starts it again.
  useEffect(() => {
    if (camera.status !== 'on') return
    const element = video.current!
    if (frozen) {
      element.pause()
    } else {
      // Playing can be refused (e.g. if the camera has just stopped); the
      // camera's own events report that.
      Promise.resolve(element.play()).catch(() => {})
    }
  }, [frozen, camera.status])

  return (
    <>
      {/* playsInline and muted: without them, iPhones play camera video full screen, or not at all. */}
      <video ref={video} autoPlay playsInline muted />
      {camera.status === 'on' && (
        <div className="scan-guide" ref={guide} aria-hidden="true">
          {Array.from({ length: 9 }, (_, n) => (
            <span key={n}>
              {photo && (
                <i
                  className="scan-dot"
                  style={{ background: STICKER_COLORS[photo[n]] }}
                />
              )}
            </span>
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

/** A camera, for the Scan and Take photo buttons. */
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
