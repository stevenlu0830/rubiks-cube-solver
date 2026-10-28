import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Quaternion, Vector2, type Group, type PerspectiveCamera } from 'three'
import type { Move } from '../cube/moves.ts'
import type { CubeState } from '../cube/state.ts'
import { canDraw3D } from '../device/webgl.ts'
import { arrowPlacement } from './arrows.ts'
import { CAMERA_DIRECTION, CAMERA_FOV, fitCameraDistance } from './camera.ts'
import { createGestureTracker, type SwipeDirection } from './gestures.ts'
import { CUBIES, type CubieLayout } from './layout.ts'
import { letterSpins } from './letters.ts'
import {
  ARROW_GEOMETRY,
  ARROW_MATERIAL,
  ARROW_OUTLINE_GEOMETRY,
  ARROW_OUTLINE_MATERIAL,
  BODY_GEOMETRY,
  BODY_MATERIAL,
  DOUBLE_ARROW_GEOMETRY,
  DOUBLE_ARROW_OUTLINE_GEOMETRY,
  HIGHLIGHT_GEOMETRY,
  HIGHLIGHT_MATERIAL,
  STICKER_GEOMETRY,
  stickerMaterial,
} from './materials.ts'
import { turnBySwipe } from './orientation.ts'
import { isInTurningLayer, turnRotation } from './turns.ts'

/** How long a swipe's quarter turn of the whole cube takes to animate. */
const SWIPE_TURN_MS = 250

const UNTURNED = new Quaternion()

interface CubeViewProps {
  state: CubeState
  /** Called with the cell index when the user taps a sticker. */
  onCellTap?: (cell: number) => void
  /** Cells to point out (e.g. ones painted wrong); the rest are dimmed. */
  highlight?: readonly number[]
  /** Called with the cube's new orientation each time a swipe turns it. */
  onOrientationChange?: (orientation: Quaternion) => void
  /** Ignore swipes and taps, e.g. while the solver is working. */
  disabled?: boolean
  /**
   * While solving: `state` is already in the holding position (as returned
   * by cubeAsShown), so it's shown unturned, and swipes and taps are ignored.
   */
  held?: boolean
  /** A face turn to animate on `state`. */
  turn?: Move | null
  turnDurationMs?: number
  /** Called once `turn` has finished animating. */
  onTurnDone?: () => void
  /** A face turn to point out with an arrow. */
  hint?: Move | null
  /** Write each sticker's colour letter on it (W, Y, G…), for colour-blind users. */
  letters?: boolean
}

/**
 * Draws the cube in 3D. While painting, it turns when the user swipes and
 * reports taps on stickers; while solving, it animates face turns. It never
 * changes `state` itself: that's up to the parent.
 */
export function CubeView(props: CubeViewProps) {
  if (!canDraw3D()) {
    return (
      <p className="no-3d" role="alert">
        This browser can't draw the 3D cube (it needs WebGL 2, which is off or
        not supported here). Try updating the browser, or another one.
      </p>
    )
  }
  return (
    <Canvas
      // Render at the screen's full pixel density (up to 3× on recent phones) so edges stay sharp.
      dpr={[1, 3]}
      // Only redraw when something changes, instead of 60 times a second: saves battery.
      frameloop="demand"
      // No tone mapping: stickers show their exact colours.
      flat
      camera={{ fov: CAMERA_FOV, near: 0.1, far: 100 }}
    >
      <CameraFit />
      <ambientLight intensity={2.2} />
      <directionalLight position={[2, 4, 6]} intensity={1.6} />
      <TurnableCube {...props} />
    </Canvas>
  )
}

/** The cube itself, plus the touch handling that turns it and paints it. */
function TurnableCube({
  state,
  onCellTap,
  highlight,
  onOrientationChange,
  disabled = false,
  held = false,
  turn = null,
  turnDurationMs = 500,
  onTurnDone,
  hint = null,
  letters = false,
}: CubeViewProps) {
  const cube = useRef<Group>(null!)
  const highlighted = useMemo(() => new Set(highlight), [highlight])
  const canvas = useThree((s) => s.gl.domElement)
  const camera = useThree((s) => s.camera)
  const raycaster = useThree((s) => s.raycaster)
  const invalidate = useThree((s) => s.invalidate)

  /** Where the cube ends up once the current swipe turn (if any) finishes. */
  const orientation = useRef(new Quaternion())
  /** Where it was when it last stood still: letters are turned upright for this. */
  const [restingOrientation, setRestingOrientation] = useState(UNTURNED)
  const swipeTurn = useRef<{
    from: Quaternion
    to: Quaternion
    startedAt: number
  } | null>(null)
  const ignoreTouches = held || disabled
  const spins = useMemo(
    () => (letters ? letterSpins(held ? UNTURNED : restingOrientation) : null),
    [letters, held, restingOrientation],
  )

  // Entering or leaving the holding position. Held states are already turned
  // the way the user sees them, so show them unturned; on leaving, go back
  // to the painting view exactly as it was.
  useLayoutEffect(() => {
    swipeTurn.current = null
    cube.current.quaternion.copy(held ? UNTURNED : orientation.current)
    invalidate()
  }, [held, invalidate])

  const handleSwipe = useEffectEvent((direction: SwipeDirection) => {
    if (ignoreTouches || swipeTurn.current) return // e.g. still turning
    const from = orientation.current
    const to = turnBySwipe(from, direction)
    orientation.current = to
    swipeTurn.current = { from, to, startedAt: performance.now() }
    invalidate()
    onOrientationChange?.(to)
  })

  const handleTap = useEffectEvent((clientX: number, clientY: number) => {
    // While the cube turns, stickers are moving; a tap could hit the wrong one.
    if (ignoreTouches || swipeTurn.current) return
    // Find what's under the finger. Hits are sorted nearest first; if that's
    // the black plastic between stickers, there's no cell to paint.
    const rect = canvas.getBoundingClientRect()
    const pointer = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(pointer, camera)
    cube.current.updateMatrixWorld()
    const [nearest] = raycaster.intersectObject(cube.current, true)
    const cell: unknown = nearest?.object.userData.cell
    if (typeof cell === 'number') onCellTap?.(cell)
  })

  useEffect(() => {
    const tracker = createGestureTracker({
      onTap: handleTap,
      onSwipe: handleSwipe,
    })
    const down = (event: PointerEvent) => {
      // Keep receiving this finger's events even if it slides off the canvas.
      canvas.setPointerCapture(event.pointerId)
      tracker.down(event)
    }
    const up = (event: PointerEvent) => tracker.up(event)
    const cancel = (event: PointerEvent) => tracker.cancel(event)
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', cancel)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', cancel)
    }
  }, [canvas])

  // Runs before each redraw while a swipe turn is animating.
  useFrame(() => {
    if (!swipeTurn.current) return
    const { from, to, startedAt } = swipeTurn.current
    // Progress comes from the clock, not a frame count, so a slow phone finishes on time.
    const progress = Math.min(
      1,
      (performance.now() - startedAt) / SWIPE_TURN_MS,
    )
    const eased = 1 - (1 - progress) ** 3 // fast start, gentle stop
    cube.current.quaternion.slerpQuaternions(from, to, eased)
    if (progress < 1) {
      invalidate() // ask for the next frame
    } else {
      cube.current.quaternion.copy(to)
      swipeTurn.current = null
      setRestingOrientation(to)
    }
  })

  return (
    <group ref={cube}>
      <Cubies
        state={state}
        highlighted={highlighted}
        spins={spins}
        turn={turn}
        turnDurationMs={turnDurationMs}
        onTurnDone={onTurnDone}
      />
      {hint && !turn && <TurnArrow move={hint} />}
    </group>
  )
}

interface CubiesProps {
  state: CubeState
  highlighted: ReadonlySet<number>
  /** With letters on: how far to spin each cell's sticker so its letter is upright. */
  spins: readonly number[] | null
  turn: Move | null
  turnDurationMs: number
  onTurnDone?: () => void
}

/**
 * The 26 cubies. During a face turn, the 9 in the turning layer sit in a
 * "pivot" group that rotates about the face's centre. When it finishes, the
 * parent swaps in the new cube state and the pivot empties: the stickers end
 * up exactly where the rotation left them, so the swap can't be seen.
 */
function Cubies({
  state,
  highlighted,
  spins,
  turn,
  turnDurationMs,
  onTurnDone,
}: CubiesProps) {
  const pivot = useRef<Group>(null!)
  const invalidate = useThree((s) => s.invalidate)
  const animation = useRef<{ startedAt: number; finished: boolean } | null>(
    null,
  )

  const rotation = useMemo(() => turn && turnRotation(turn), [turn])

  useLayoutEffect(() => {
    pivot.current.quaternion.identity()
    animation.current = turn
      ? { startedAt: performance.now(), finished: false }
      : null
    invalidate()
  }, [turn, invalidate])

  useFrame(() => {
    const current = animation.current
    if (!rotation || !current || current.finished) return
    const progress = Math.min(
      1,
      (performance.now() - current.startedAt) / turnDurationMs,
    )
    // Gentle start and stop, like turning a real cube.
    const eased =
      progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
    pivot.current.quaternion.setFromAxisAngle(
      rotation.axis,
      rotation.angle * eased,
    )
    if (progress < 1) {
      invalidate()
    } else {
      current.finished = true
      onTurnDone?.()
    }
  })

  const inLayer = (cubie: CubieLayout) =>
    turn !== null && isInTurningLayer(cubie.position, turn)
  const draw = (cubie: CubieLayout) => (
    <Cubie
      key={cubie.position.join()}
      cubie={cubie}
      state={state}
      highlighted={highlighted}
      spins={spins}
    />
  )
  return (
    <>
      {CUBIES.filter((cubie) => !inLayer(cubie)).map(draw)}
      <group ref={pivot}>{CUBIES.filter(inLayer).map(draw)}</group>
    </>
  )
}

interface CubieProps {
  cubie: CubieLayout
  state: CubeState
  highlighted: ReadonlySet<number>
  spins: readonly number[] | null
}

function Cubie({ cubie, state, highlighted, spins }: CubieProps) {
  return (
    <group position={cubie.position}>
      <mesh geometry={BODY_GEOMETRY} material={BODY_MATERIAL} />
      {cubie.stickers.map(({ cell, offset, spun }) => (
        <mesh
          key={cell}
          geometry={STICKER_GEOMETRY}
          material={stickerMaterial(
            state[cell],
            highlighted.size > 0 && !highlighted.has(cell),
            spins !== null,
          )}
          position={offset}
          quaternion={spun[spins?.[cell] ?? 0]}
          // Tag each sticker with its cell, so a tap can tell which cell was hit.
          userData={{ cell }}
        >
          {highlighted.has(cell) && (
            // Just behind the sticker, so only its rim shows as a border.
            <mesh
              geometry={HIGHLIGHT_GEOMETRY}
              material={HIGHLIGHT_MATERIAL}
              position={[0, 0, -0.001]}
              userData={{ cell }}
            />
          )}
        </mesh>
      ))}
    </group>
  )
}

/** An arrow lying on the cube, showing which way the next face turn goes. */
function TurnArrow({ move }: { move: Move }) {
  const { position, quaternion, doubleHeaded } = useMemo(
    () => arrowPlacement(move),
    [move],
  )
  return (
    <group position={position} quaternion={quaternion}>
      <mesh
        geometry={
          doubleHeaded ? DOUBLE_ARROW_OUTLINE_GEOMETRY : ARROW_OUTLINE_GEOMETRY
        }
        material={ARROW_OUTLINE_MATERIAL}
        position={[0, 0, -0.005]}
      />
      <mesh
        geometry={doubleHeaded ? DOUBLE_ARROW_GEOMETRY : ARROW_GEOMETRY}
        material={ARROW_MATERIAL}
      />
    </group>
  )
}

/** Moves the camera back just far enough for the cube to fill the canvas, whatever its shape. */
function CameraFit() {
  const camera = useThree((s) => s.camera as PerspectiveCamera)
  const { width, height } = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

  // useEffect, not useLayoutEffect: layout effects run before the Canvas has
  // finished starting up, and it ignores redraw requests (invalidate) until then.
  useEffect(() => {
    if (width === 0 || height === 0) return
    const distance = fitCameraDistance(
      CAMERA_DIRECTION,
      camera.fov,
      width / height,
    )
    camera.position.copy(CAMERA_DIRECTION).multiplyScalar(distance)
    camera.lookAt(0, 0, 0)
    invalidate()
  }, [camera, width, height, invalidate])

  return null
}
