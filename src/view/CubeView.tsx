import { Canvas, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { PerspectiveCamera } from 'three'
import type { CubeState } from '../cube/state.ts'
import { CAMERA_DIRECTION, CAMERA_FOV, fitCameraDistance } from './camera.ts'
import { CUBIES, type CubieLayout } from './layout.ts'
import {
  BODY_GEOMETRY,
  BODY_MATERIAL,
  STICKER_GEOMETRY,
  stickerMaterial,
} from './materials.ts'

interface CubeViewProps {
  state: CubeState
}

/** Draws the cube in 3D. It only displays `state`; it never changes it. */
export function CubeView({ state }: CubeViewProps) {
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
      <group>
        {CUBIES.map((cubie) => (
          <Cubie key={cubie.position.join()} cubie={cubie} state={state} />
        ))}
      </group>
    </Canvas>
  )
}

function Cubie({ cubie, state }: { cubie: CubieLayout; state: CubeState }) {
  return (
    <group position={cubie.position}>
      <mesh geometry={BODY_GEOMETRY} material={BODY_MATERIAL} />
      {cubie.stickers.map(({ cell, offset, quaternion }) => (
        <mesh
          key={cell}
          geometry={STICKER_GEOMETRY}
          material={stickerMaterial(state[cell])}
          position={offset}
          quaternion={quaternion}
          // Tag each sticker with its cell, so a tap can tell which cell was hit.
          userData={{ cell }}
        />
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
