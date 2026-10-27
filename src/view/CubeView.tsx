import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useEffectEvent, useMemo, useRef } from 'react'
import { Quaternion, Vector2, type Group, type PerspectiveCamera } from 'three'
import type { CubeState } from '../cube/state.ts'
import { CAMERA_DIRECTION, CAMERA_FOV, fitCameraDistance } from './camera.ts'
import { createGestureTracker, type SwipeDirection } from './gestures.ts'
import { CUBIES, type CubieLayout } from './layout.ts'
import {
  BODY_GEOMETRY,
  BODY_MATERIAL,
  HIGHLIGHT_GEOMETRY,
  HIGHLIGHT_MATERIAL,
  STICKER_GEOMETRY,
  stickerMaterial,
} from './materials.ts'
import { turnBySwipe } from './orientation.ts'

/** How long a swipe's quarter turn takes to animate. */
const TURN_DURATION_MS = 250

interface CubeViewProps {
  state: CubeState
  /** Called with the cell index when the user taps a sticker. */
  onCellTap?: (cell: number) => void
  /** Cells to point out (e.g. ones painted wrong); the rest are dimmed. */
  highlight?: readonly number[]
  /** Called with the cube's new orientation each time a swipe turns it. */
  onOrientationChange?: (orientation: Quaternion) => void
}

/**
 * Draws the cube in 3D, turns it when the user swipes, and reports taps on
 * stickers. It never changes `state`: painting is up to the parent.
 */
export function CubeView(props: CubeViewProps) {
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
}: CubeViewProps) {
  const cube = useRef<Group>(null!)
  const highlighted = useMemo(() => new Set(highlight), [highlight])
  const canvas = useThree((s) => s.gl.domElement)
  const camera = useThree((s) => s.camera)
  const raycaster = useThree((s) => s.raycaster)
  const invalidate = useThree((s) => s.invalidate)

  /** Where the cube ends up once the current turn (if any) finishes. */
  const orientation = useRef(new Quaternion())
  const turn = useRef<{
    from: Quaternion
    to: Quaternion
    startedAt: number
  } | null>(null)

  const handleSwipe = useEffectEvent((direction: SwipeDirection) => {
    if (turn.current) return // ignore swipes while the cube is still turning
    const from = orientation.current
    const to = turnBySwipe(from, direction)
    orientation.current = to
    turn.current = { from, to, startedAt: performance.now() }
    invalidate()
    onOrientationChange?.(to)
  })

  const handleTap = useEffectEvent((clientX: number, clientY: number) => {
    if (turn.current) return // stickers are moving; a tap now could hit the wrong one
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

  // Runs before each redraw while a turn is animating.
  useFrame(() => {
    if (!turn.current) return
    const { from, to, startedAt } = turn.current
    // Progress comes from the clock, not a frame count, so a slow phone finishes on time.
    const progress = Math.min(
      1,
      (performance.now() - startedAt) / TURN_DURATION_MS,
    )
    const eased = 1 - (1 - progress) ** 3 // fast start, gentle stop
    cube.current.quaternion.slerpQuaternions(from, to, eased)
    if (progress < 1) {
      invalidate() // ask for the next frame
    } else {
      cube.current.quaternion.copy(to)
      turn.current = null
    }
  })

  return (
    <group ref={cube}>
      {CUBIES.map((cubie) => (
        <Cubie
          key={cubie.position.join()}
          cubie={cubie}
          state={state}
          highlighted={highlighted}
        />
      ))}
    </group>
  )
}

interface CubieProps {
  cubie: CubieLayout
  state: CubeState
  highlighted: ReadonlySet<number>
}

function Cubie({ cubie, state, highlighted }: CubieProps) {
  return (
    <group position={cubie.position}>
      <mesh geometry={BODY_GEOMETRY} material={BODY_MATERIAL} />
      {cubie.stickers.map(({ cell, offset, quaternion }) => (
        <mesh
          key={cell}
          geometry={STICKER_GEOMETRY}
          material={stickerMaterial(
            state[cell],
            highlighted.size > 0 && !highlighted.has(cell),
          )}
          position={offset}
          quaternion={quaternion}
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
