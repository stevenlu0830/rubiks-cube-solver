import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type Ref,
} from 'react'
import type { Quaternion } from 'three'
import type { Puzzle } from '../cube/puzzle.ts'
import {
  CENTER,
  colorCounts,
  FACES,
  type Color,
  type CubeState,
  type Face,
} from '../cube/state.ts'
import { Palette } from '../editor/Palette.tsx'
import { usePuzzle } from '../puzzleContext.ts'
import { CubeNet } from '../solve/CubeNet.tsx'
import { COLOR_LETTERS, LETTER_INK, STICKER_COLORS } from '../view/colors.ts'
import type { SwipeDirection } from '../view/gestures.ts'
import {
  cubeAsShown,
  frontCells,
  frontFace,
  screenSideOf,
  turnBySwipe,
} from '../view/orientation.ts'
import {
  CameraError,
  cameraErrorMessage,
  facesUser,
  hasTorch,
  openCamera,
  stopCamera,
  switchTorch,
} from './camera.ts'
import type { Classified } from './classify.ts'
import { rgbToLab, type Lab } from './colorSpace.ts'
import {
  looksLikeSide,
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
import { findTurnedSides, turnSides } from './turnedSides.ts'
import './scan.css'

/** How often the live dots and warnings update while lining a side up. */
const LOOK_EVERY_MS = 250

/** With Auto photo on: how long a side must stay still and clear before its photo is taken. */
const AUTO_PHOTO_MS = 500

/** The squares of a side, by name, for screen readers: a 3x3's 9, or a 2x2's 4. */
const SQUARE_NAMES: Record<Puzzle['size'], readonly string[]> = {
  3: [
    'top left',
    'top',
    'top right',
    'left',
    'centre',
    'right',
    'bottom left',
    'bottom',
    'bottom right',
  ],
  2: ['top left', 'top right', 'bottom left', 'bottom right'],
}

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
  /** Show each colour's letter on the dots and in the colour picker, as on the stickers. */
  letters?: boolean
  /** Take each side's photo by itself, once it's held still. */
  autoPhoto?: boolean
}

/** The camera, once its picture is showing. */
interface LiveCamera {
  /** It faces the user, like a laptop's, so its picture is shown mirrored. */
  facingYou: boolean
}

/** A look through the camera, kept for the next one to compare with. */
interface Look {
  readings: Lab[]
  /** How many looks in a row the picture has been still and clear. */
  steady: number
}

/**
 * The scan screen, above the 3D cube: what the camera sees, with a grid
 * (3×3, or 2×2 for a 2x2) to line one side up in, and the buttons to
 * photograph each side in turn. The camera is on only while this is shown
 * and the app is on screen.
 */
export function Scanner({
  cube,
  orientation,
  onTurn,
  onPaint,
  onDone,
  letters = false,
  autoPhoto = false,
}: ScannerProps) {
  const puzzle = usePuzzle()
  const squareNames = SQUARE_NAMES[puzzle.size]
  const visible = usePageVisible()
  // Try again bumps this: a new key starts a new CameraView, so a fresh camera.
  const [attempt, setAttempt] = useState(0)
  const camera = useRef<CameraHandle>(null)
  const [live, setLive] = useState<LiveCamera | null>(null)
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
    /** About to take the photo by itself, if the picture stays still. */
    ready: boolean
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
  const liveColors =
    live && !frozen && lastLook?.orientation === orientation ? lastLook : null
  const facingYou = live?.facingYou ?? false
  // Once all six are in, a side photographed turned round can be spotted.
  const turned = useMemo(() => findTurnedSides(sides, named), [sides, named])
  const turnedNames = FACES.filter((face) => turned?.[face]).map(sideName)

  /**
   * A side, to name it to the user: a 3x3's by its centre's colour ("the
   * green side"); a 2x2's by where it is on screen now ("the left side").
   */
  function sideName(face: Face): string {
    return puzzle.hasCenters
      ? named.get(sides[face]!.cells[CENTER])!.color
      : screenSideOf(orientation, face)
  }

  /** Paints every scanned square (a new photo can change earlier sides), as one Undo step. */
  function paint(nextSides: ScannedSides, nextFixes: Fixes, nextLight = light) {
    const nextNamed = readScannedCube(nextSides, nextFixes)
    onPaint([...nextNamed].map(([cell, { color }]) => [cell, color]))
    if (debug) {
      saveRecordedScan(recordScan(scanId, nextLight, nextSides, nextNamed))
    }
  }

  function takePhoto(squares = camera.current?.look()) {
    if (!squares) return // no picture yet
    const cells = frontCells(orientation, puzzle)
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

  /** Turns the sides that look photographed turned back round. */
  function turnBack() {
    if (!turned) return
    const next = turnSides(sides, fixes, turned)
    setSides(next.sides)
    setFixes(next.fixes)
    setPicking(null)
    paint(next.sides, next.fixes)
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
  // show what a photo would read, and any problem with the picture. With
  // Auto photo on, once it's been still and clear long enough, take it.
  const lookAgain = useEffectEvent((last: Look | null): Look | null => {
    const squares = camera.current?.look()
    if (!squares) return null
    const readings = squares.map(({ color }) => rgbToLab(color))
    const cells = frontCells(orientation, puzzle)
    const preview = { ...sides, [front]: { cells, rgb: [], readings } }
    const previewNamed = readScannedCube(preview, withoutCells(fixes, cells))
    const colors = cells.map((cell) => previewNamed.get(cell)!.color)
    const problem = pictureProblem(
      squares,
      readings,
      colors,
      last?.readings ?? null,
    )
    const steady = problem === null && last ? last.steady + 1 : 0
    // Only a side's first photo, so a retake waits for the button. And only
    // of what looks like a side of a cube, but not one already scanned: just
    // after Next side, the camera still sees the last side until the real
    // cube is turned.
    const ready =
      autoPhoto &&
      sides[front] === undefined &&
      steady > 0 &&
      looksLikeSide(squares) &&
      repeatedSide(preview, front) === null
    if (ready && steady * LOOK_EVERY_MS >= AUTO_PHOTO_MS) {
      takePhoto(squares)
      return null
    }
    setLastLook({ orientation, colors, problem, ready })
    return { readings, steady }
  })
  const isLive = live !== null
  useEffect(() => {
    if (!isLive || frozen) return
    let last: Look | null = null
    const timer = setInterval(() => {
      last = lookAgain(last)
    }, LOOK_EVERY_MS)
    return () => clearInterval(timer)
  }, [isLive, frozen])

  // A laptop's camera faces you, so the side to photograph faces it, not you.
  const toCamera = 'Turn your cube so the side outlined below faces the camera'
  const lineUp = facingYou
    ? toCamera
    : 'Turn your cube the same way as the one below, so the outlined side faces you'
  const lineUpAgain = facingYou
    ? toCamera
    : 'Turn your cube to match the one below'
  const thenPhoto = autoPhoto
    ? 'then hold it still for a photo'
    : 'then take a photo'
  const turnedText =
    turned &&
    (turnedNames.length === 1
      ? `The ${turnedNames[0]} side looks turned. Fix it?`
      : `The ${listWords(turnedNames)} sides look turned. Fix them?`)

  function instruction(): string {
    if (photo) {
      if (repeat && puzzle.hasCenters) {
        return `You've already scanned the ${sideName(repeat)} side. ${lineUpAgain}, then retake.`
      }
      if (repeat) {
        // Two sides of a 2x2 can look alike, so it might not be a repeat.
        return `This looks like the ${sideName(repeat)} side, which you've already scanned. If it is, ${lowerFirst(lineUpAgain)}, then retake.`
      }
      if (turnedText) return turnedText
      if (unsure > 0) {
        return `${unsure === 1 ? '1 square' : `${unsure} squares`} might be wrong (outlined). Tap one to pick its colour.`
      }
      return allScanned
        ? 'All six sides are in. Tap Done, then check the cube and tap Solve.'
        : 'Check the colours. If one is wrong, tap it to pick the right colour, or retake the photo.'
    }
    if (turnedText) return turnedText
    if (scanned.size === 0) {
      return `Hold any side of your cube up to the camera so it fills the grid, ${thenPhoto}.`
    }
    if (scanned.has(front)) {
      return allScanned
        ? 'All six sides are in. Take another photo to replace this side, or tap Done.'
        : 'This side is done. Take another photo to replace it, or go to the next side.'
    }
    if (turn?.to === orientation) {
      return `${turnInstruction(turn.swipes, { facingYou })}, ${thenPhoto}.`
    }
    return `${lineUp}, ${thenPhoto}.`
  }

  // The main button stands out, unless a turned side should be fixed first.
  const main = turned ? undefined : 'scan-primary'
  const fixTurned = turned && (
    <button type="button" className="scan-primary" onClick={turnBack}>
      {turnedNames.length === 1 ? 'Fix it' : 'Fix them'}
    </button>
  )
  const goOn = allScanned ? (
    <button type="button" className={main} onClick={onDone}>
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
      <div
        className="viewfinder"
        data-mirrored={facingYou || undefined}
        data-ready={liveColors?.ready || undefined}
        // Squares along each edge of the grid, for scan.css.
        style={{ '--grid': puzzle.size } as CSSProperties}
      >
        {/* Off while the app is in the background: saves battery, and frees the camera for other apps. */}
        {visible && (
          <CameraView
            key={attempt}
            ref={camera}
            size={puzzle.size}
            frozen={frozen}
            onLive={setLive}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        )}
        {live && photo && (
          <PhotoSquares
            squares={photo}
            names={squareNames}
            picking={picking}
            onPick={(cell) => setPicking(cell === picking ? null : cell)}
            letters={letters}
          />
        )}
        {liveColors && (
          <div className="scan-dots scan-dots-live" aria-hidden="true">
            {liveColors.colors.map((color, n) => (
              <span key={n}>
                <Dot color={color} letters={letters} />
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
          <p>Pick the colour of the {squareNames[pickingSquare]} square:</p>
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
              {fixTurned}
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
                className={main}
                onClick={() => takePhoto()}
                disabled={!live}
              >
                <CameraIcon />
                Take photo
              </button>
              {fixTurned}
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
            data-warning={repeat || turnedText ? true : undefined}
            aria-live="polite"
          >
            {/* Screen readers hear what each photo read, then what to do. */}
            {photo && (
              <span className="visually-hidden">
                {describePhoto(photo, puzzle.size)}{' '}
              </span>
            )}
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

/** What a photo read, for screen readers: "Colours read, row by row: red, white, blue; …". */
function describePhoto(squares: readonly Classified[], size: number): string {
  const rows = Array.from({ length: size }, (_, row) =>
    squares
      .slice(row * size, (row + 1) * size)
      .map(({ color, unsure }) => (unsure ? `${color} (not sure)` : color))
      .join(', '),
  )
  return `Colours read, row by row: ${rows.join('; ')}.`
}

/** "Turn your cube" → "turn your cube", to go mid-sentence. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/** "red", "red and blue", "red, green and blue". */
function listWords(words: readonly string[]): string {
  return words.length <= 1
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
}

/** Fixes, except for these cells. */
function withoutCells(fixes: Fixes, cells: readonly number[]): Fixes {
  const kept = { ...fixes }
  for (const cell of cells) delete kept[cell]
  return kept
}

/** A colour read, as a dot on its square, with its letter if letters are on. */
function Dot({
  color,
  letters,
  unsure = false,
}: {
  color: Color
  letters: boolean
  unsure?: boolean
}) {
  return (
    <i
      className="scan-dot"
      data-unsure={unsure || undefined}
      style={{ background: STICKER_COLORS[color], color: LETTER_INK[color] }}
    >
      {letters && COLOR_LETTERS[color]}
    </i>
  )
}

interface PhotoSquaresProps {
  squares: (Classified & { cell: number })[]
  /** Each square's name, for screen readers. */
  names: readonly string[]
  picking: number | null
  onPick: (cell: number) => void
  letters: boolean
}

/**
 * The colours read from a photo, a dot on each square. Tapping a square
 * picks its colour by hand; ones the app is unsure of are outlined.
 */
function PhotoSquares({
  squares,
  names,
  picking,
  onPick,
  letters,
}: PhotoSquaresProps) {
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
          aria-label={`${names[n]}: ${color}${unsure ? ', not sure' : ''}`}
          onClick={() => onPick(cell)}
        >
          <Dot color={color} letters={letters} unsure={unsure} />
        </button>
      ))}
    </div>
  )
}

type CameraState =
  | { status: 'starting' }
  | { status: 'on'; facingYou: boolean }
  | { status: 'failed'; message: string }

interface CameraHandle {
  /** Each square in the guide right now, or null with no picture yet. */
  look: () => Square[] | null
}

interface CameraViewProps {
  ref: Ref<CameraHandle>
  /** Squares along each edge of the guide: 3 for a 3x3, 2 for a 2x2. */
  size: number
  /** Hold the picture still, for a photo. */
  frozen: boolean
  /** Told about the camera once its picture is showing, and null when it stops. */
  onLive: (camera: LiveCamera | null) => void
  onRetry: () => void
}

/** Starts the camera when shown and stops it when removed, whatever happens in between. */
function CameraView({ ref, size, frozen, onLive, onRetry }: CameraViewProps) {
  const video = useRef<HTMLVideoElement>(null)
  const guide = useRef<HTMLDivElement>(null)
  const track = useRef<MediaStreamTrack | null>(null)
  const [camera, setCamera] = useState<CameraState>({ status: 'starting' })
  /** The camera's torch: null where it has none, else whether it's on. */
  const [torch, setTorch] = useState<boolean | null>(null)
  const reportLive = useEffectEvent((live: LiveCamera | null) => onLive(live))
  const mirrored = camera.status === 'on' && camera.facingYou

  useImperativeHandle(ref, () => ({
    look() {
      const pixels =
        video.current && guide.current
          ? grabFrame(video.current, guide.current, { mirrored })
          : null
      return pixels && inspectSquares(pixels, size)
    },
  }))

  /** Offers the torch, if the camera has one. */
  function findTorch() {
    if (track.current && hasTorch(track.current)) {
      setTorch((on) => on ?? false)
    }
  }
  const findTorchNow = useEffectEvent(findTorch)

  function toggleTorch() {
    if (!track.current || torch === null) return
    const on = !torch
    switchTorch(track.current, on).then(
      () => setTorch(on),
      () => setTorch(null), // it didn't work: stop offering it
    )
  }

  useEffect(() => {
    const element = video.current!
    let stream: MediaStream | null = null
    let closed = false
    const fail = (error: unknown) => {
      if (closed) return
      setCamera({ status: 'failed', message: cameraErrorMessage(error) })
      reportLive(null)
    }
    openCamera().then((opened) => {
      // Closed while the browser was still asking for permission: switch it straight off.
      if (closed) {
        stopCamera(opened)
        return
      }
      stream = opened
      element.srcObject = opened
      const [videoTrack] = opened.getVideoTracks()
      track.current = videoTrack ?? null
      videoTrack?.addEventListener('ended', () =>
        fail(new CameraError('stopped')),
      )
      const facingYou = videoTrack ? facesUser(videoTrack) : false
      setCamera({ status: 'on', facingYou })
      findTorchNow()
      reportLive({ facingYou })
    }, fail)
    return () => {
      closed = true
      track.current = null
      element.srcObject = null
      if (stream) stopCamera(stream)
      reportLive(null)
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
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        // Some phones only say they have a torch once the picture starts.
        onLoadedMetadata={findTorch}
      />
      {camera.status === 'on' && (
        <div className="scan-guide" ref={guide} aria-hidden="true">
          {/* Lines between the squares: right of all but the last column, under all but the last row. */}
          {Array.from({ length: size * size }, (_, n) => (
            <span
              key={n}
              data-line-right={n % size < size - 1 || undefined}
              data-line-below={n < size * (size - 1) || undefined}
            />
          ))}
        </div>
      )}
      {camera.status === 'on' && torch !== null && (
        <button
          type="button"
          className="scan-torch"
          aria-label="Torch"
          aria-pressed={torch}
          onClick={toggleTorch}
        >
          <TorchIcon />
        </button>
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

/** A torch, for the button that switches the camera's light on. */
function TorchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M7 3h10v4l-2.5 4v9a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-9L7 7z" />
        <path d="M7 7h10M12 13v2" />
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
