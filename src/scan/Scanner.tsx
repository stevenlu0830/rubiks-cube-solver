import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from 'react'
import type { Quaternion } from 'three'
import {
  CENTER,
  colorCounts,
  FACES,
  type Color,
  type CubeState,
} from '../cube/state.ts'
import { Palette } from '../editor/Palette.tsx'
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
import type { Classified } from './classify.ts'
import { rgbToLab, type Lab } from './colorSpace.ts'
import {
  pictureProblem,
  PROBLEM_MESSAGES,
  type PictureProblem,
} from './problems.ts'
import { grabFrame, inspectSquares, type Square } from './sample.ts'
import { ScanDebugPanel } from './ScanDebugPanel.tsx'
import {
  isScanDebug,
  recordScan,
  saveRecordedScan,
  type Light,
} from './scanDebug.ts'
import {
  nextSideTurns,
  readScannedCube,
  repeatedSide,
  turnInstruction,
  type Fixes,
  type ScannedSides,
} from './sides.ts'
import './scan.css'

/** How often the live dots and warnings update while lining a side up. */
const LOOK_EVERY_MS = 250

/** The 9 squares of a side, by name, for screen readers. */
const SQUARE_NAMES = [
  'top left',
  'top',
  'top right',
  'left',
  'centre',
  'right',
  'bottom left',
  'bottom',
  'bottom right',
]

interface ScannerProps {
  /** The painted cube, for the map of all six sides. */
  cube: CubeState
  /** Which way round the 3D cube is shown: its front is the side to photograph. */
  orientation: Quaternion
  /** Turns the 3D cube, for Next side. */
  onTurn: (orientation: Quaternion) => void
  /** Paints every scanned square, as [cell, colour] pairs. */
  onPaint: (paints: [number, Color][]) => void
  /** Back to painting, once all six sides are in. */
  onDone: () => void
  /** Show each colour's letter in the colour picker, as on the stickers. */
  letters?: boolean
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
  letters = false,
}: ScannerProps) {
  const visible = usePageVisible()
  // Try again bumps this: a new key starts a new CameraView, so a fresh camera.
  const [attempt, setAttempt] = useState(0)
  const camera = useRef<CameraHandle>(null)
  const [live, setLive] = useState(false)
  const [sides, setSides] = useState<ScannedSides>({})
  const [fixes, setFixes] = useState<Fixes>({})
  /** Which way the cube was turned for the last photo: it shows while the cube stays so. */
  const [photoAt, setPhotoAt] = useState<Quaternion | null>(null)
  /** The photo's square being fixed by hand, by cell. */
  const [picking, setPicking] = useState<number | null>(null)
  /** The last time Next side turned the cube, to say how to turn the real one. */
  const [turn, setTurn] = useState<{
    to: Quaternion
    swipes: SwipeDirection[]
  } | null>(null)
  /** The latest look through the camera before a photo: live dots, and any problem. */
  const [lastLook, setLastLook] = useState<{
    orientation: Quaternion
    colors: Color[]
    problem: PictureProblem | null
  } | null>(null)
  // ?scan-debug: record each scan, to keep as test data.
  const [debug] = useState(() => isScanDebug())
  const [scanId] = useState(() => new Date().toISOString())
  const [light, setLight] = useState<Light>('daylight')

  const front = frontFace(orientation)
  const frozen = photoAt === orientation && sides[front] !== undefined
  const named = useMemo(() => readScannedCube(sides, fixes), [sides, fixes])
  const scanned = new Set(FACES.filter((face) => sides[face]))
  const allScanned = scanned.size === FACES.length
  const photo = frozen
    ? sides[front]!.cells.map((cell) => ({ cell, ...named.get(cell)! }))
    : null
  const unsure = photo?.filter((square) => square.unsure).length ?? 0
  const repeat = frozen ? repeatedSide(sides, front) : null
  const repeatColor = repeat && named.get(sides[repeat]!.cells[CENTER])!.color
  const liveColors =
    live && !frozen && lastLook?.orientation === orientation ? lastLook : null

  /** Paints every scanned square (a new photo can change earlier sides), as one Undo step. */
  function paint(nextSides: ScannedSides, nextFixes: Fixes, nextLight = light) {
    const nextNamed = readScannedCube(nextSides, nextFixes)
    onPaint([...nextNamed].map(([cell, { color }]) => [cell, color]))
    if (debug) {
      saveRecordedScan(recordScan(scanId, nextLight, nextSides, nextNamed))
    }
  }

  function takePhoto() {
    const squares = camera.current?.look()
    if (!squares) return // no picture yet
    const cells = frontCells(orientation)
    const rgb = squares.map((square) => square.color)
    const nextSides = {
      ...sides,
      [front]: { cells, rgb, readings: rgb.map(rgbToLab) },
    }
    // A new photo of a side starts it afresh, without the last one's fixes.
    const nextFixes = withoutCells(fixes, cells)
    setSides(nextSides)
    setFixes(nextFixes)
    setPhotoAt(orientation)
    setPicking(null)
    paint(nextSides, nextFixes)
  }

  function fix(cell: number, color: Color) {
    const nextFixes = { ...fixes, [cell]: color }
    setFixes(nextFixes)
    setPicking(null)
    paint(sides, nextFixes)
  }

  function retake() {
    setPhotoAt(null)
    setPicking(null)
  }

  function nextSide() {
    retake()
    const swipes = nextSideTurns(orientation, scanned)
    if (!swipes || swipes.length === 0) return
    const to = swipes.reduce(turnBySwipe, orientation)
    setTurn({ to, swipes })
    onTurn(to)
  }

  // Before a photo, look through the camera a few times a second: the dots
  // show what a photo would read, and any problem with the picture.
  const lookAgain = useEffectEvent((before: Lab[] | null) => {
    const squares = camera.current?.look()
    if (!squares) return null
    const readings = squares.map(({ color }) => rgbToLab(color))
    const cells = frontCells(orientation)
    const preview = readScannedCube(
      { ...sides, [front]: { cells, rgb: [], readings } },
      withoutCells(fixes, cells),
    )
    const colors = cells.map((cell) => preview.get(cell)!.color)
    setLastLook({
      orientation,
      colors,
      problem: pictureProblem(squares, readings, colors, before),
    })
    return readings
  })
  useEffect(() => {
    if (!live || frozen) return
    let before: Lab[] | null = null
    const timer = setInterval(() => {
      before = lookAgain(before)
    }, LOOK_EVERY_MS)
    return () => clearInterval(timer)
  }, [live, frozen])

  function instruction(): string {
    if (photo) {
      if (repeatColor) {
        return `You've already scanned the ${repeatColor} side. Turn your cube to match the one below, then retake.`
      }
      if (unsure > 0) {
        return `${unsure === 1 ? '1 square' : `${unsure} squares`} might be wrong (outlined). Tap one to pick its colour.`
      }
      return allScanned
        ? 'All six sides are in. Tap Done, then check the cube and tap Solve.'
        : 'Check the colours. If one is wrong, tap it to pick the right colour, or retake the photo.'
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
  const pickingSquare = photo?.findIndex(({ cell }) => cell === picking) ?? -1

  return (
    <section className="scanner" aria-label="Scan your cube">
      <div className="viewfinder">
        {/* Off while the app is in the background: saves battery, and frees the camera for other apps. */}
        {visible && (
          <CameraView
            key={attempt}
            ref={camera}
            frozen={frozen}
            onLive={setLive}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        )}
        {live && photo && (
          <PhotoSquares
            squares={photo}
            picking={picking}
            onPick={(cell) => setPicking(cell === picking ? null : cell)}
          />
        )}
        {liveColors && (
          <div className="scan-dots scan-dots-live" aria-hidden="true">
            {liveColors.colors.map((color, n) => (
              <span key={n}>
                <i
                  className="scan-dot"
                  style={{ background: STICKER_COLORS[color] }}
                />
              </span>
            ))}
          </div>
        )}
        {liveColors?.problem && (
          <p className="scan-warning" role="status">
            {PROBLEM_MESSAGES[liveColors.problem]}
          </p>
        )}
      </div>
      {picking !== null && pickingSquare >= 0 ? (
        <div className="scan-picker">
          <p>Pick the colour of the {SQUARE_NAMES[pickingSquare]} square:</p>
          <Palette
            label="Colour for this square"
            selected={named.get(picking)!.color}
            counts={colorCounts(cube)}
            onSelect={(color) => fix(picking, color)}
            letters={letters}
          />
          <button type="button" onClick={() => setPicking(null)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="scan-actions">
          {photo ? (
            <>
              <button type="button" onClick={retake}>
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
      )}
      <div className="scan-progress">
        <CubeNet state={cubeAsShown(cube, orientation)} activeFace="F" />
        <div>
          <p className="scan-count">
            {scanned.size} of {FACES.length} sides
          </p>
          <p
            className="scan-instruction"
            data-warning={repeatColor ? true : undefined}
            aria-live="polite"
          >
            {instruction()}
          </p>
        </div>
      </div>
      {debug && (
        <ScanDebugPanel
          light={light}
          onLight={(choice) => {
            setLight(choice)
            if (scanned.size > 0) paint(sides, fixes, choice)
          }}
        />
      )}
    </section>
  )
}

/** Fixes, except for these cells. */
function withoutCells(fixes: Fixes, cells: readonly number[]): Fixes {
  const kept = { ...fixes }
  for (const cell of cells) delete kept[cell]
  return kept
}

interface PhotoSquaresProps {
  squares: (Classified & { cell: number })[]
  picking: number | null
  onPick: (cell: number) => void
}

/**
 * The colours read from a photo, a dot on each square. Tapping a square
 * picks its colour by hand; ones the app is unsure of are outlined.
 */
function PhotoSquares({ squares, picking, onPick }: PhotoSquaresProps) {
  return (
    <div
      className="scan-dots"
      role="group"
      aria-label="Colours read: tap a square to change it"
    >
      {squares.map(({ cell, color, unsure }, n) => (
        <button
          key={cell}
          type="button"
          className="scan-square"
          aria-pressed={cell === picking}
          aria-label={`${SQUARE_NAMES[n]}: ${color}${unsure ? ', not sure' : ''}`}
          onClick={() => onPick(cell)}
        >
          <i
            className="scan-dot"
            data-unsure={unsure || undefined}
            style={{ background: STICKER_COLORS[color] }}
          />
        </button>
      ))}
    </div>
  )
}

type CameraState =
  | { status: 'starting' }
  | { status: 'on' }
  | { status: 'failed'; message: string }

interface CameraHandle {
  /** Each of the 9 squares in the guide right now, or null with no picture yet. */
  look: () => Square[] | null
}

interface CameraViewProps {
  ref: Ref<CameraHandle>
  /** Hold the picture still, for a photo. */
  frozen: boolean
  /** Told true once the camera's picture is showing, and false when it stops. */
  onLive: (live: boolean) => void
  onRetry: () => void
}

/** Starts the camera when shown and stops it when removed, whatever happens in between. */
function CameraView({ ref, frozen, onLive, onRetry }: CameraViewProps) {
  const video = useRef<HTMLVideoElement>(null)
  const guide = useRef<HTMLDivElement>(null)
  const [camera, setCamera] = useState<CameraState>({ status: 'starting' })
  const reportLive = useEffectEvent((isLive: boolean) => onLive(isLive))

  useImperativeHandle(ref, () => ({
    look() {
      const pixels =
        video.current && guide.current
          ? grabFrame(video.current, guide.current)
          : null
      return pixels && inspectSquares(pixels)
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
