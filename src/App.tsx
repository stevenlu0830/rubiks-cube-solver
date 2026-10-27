import { useEffect, useReducer, useRef, useState } from 'react'
import { Quaternion } from 'three'
import {
  CENTER,
  cellIndex,
  colorCounts,
  type Color,
  type CubeState,
} from './cube/state.ts'
import { validateCube } from './cube/validate.ts'
import {
  centersFilled,
  editorReducer,
  initialEditorState,
} from './editor/editor.ts'
import { Palette } from './editor/Palette.tsx'
import { SolveStatus, type SolveStage } from './editor/SolveStatus.tsx'
import { loadCube, saveCube } from './editor/storage.ts'
import { toFaceletString } from './solver/facelets.ts'
import { getSolver, solverErrorMessage } from './solver/solver.ts'
import { CubeView } from './view/CubeView.tsx'
import { cubeAsShown } from './view/orientation.ts'
import './App.css'

function App() {
  const [{ cube, history }, dispatch] = useReducer(
    editorReducer,
    undefined,
    () => initialEditorState(loadCube() ?? undefined),
  )
  const [color, setColor] = useState<Color>('white')
  /** Which way round the cube is shown; the solve uses it as the holding position. */
  const orientation = useRef(new Quaternion())
  const [solve, setSolve] = useState<{
    cube: CubeState
    status: SolveStage
  } | null>(null)
  // A solve only applies to the cube it was for: any edit hides it.
  const status = solve?.cube === cube ? solve.status : null
  const validation = status?.stage === 'checked' ? status.validation : null

  useEffect(() => {
    saveCube(cube)
  }, [cube])

  // Start the solver's setup now, so it's ready by the time the cube is painted.
  useEffect(() => {
    getSolver()
  }, [])

  async function handleSolve() {
    const validation = validateCube(cube)
    if (!validation.valid || validation.solved) {
      setSolve({ cube, status: { stage: 'checked', validation } })
      return
    }

    // Read the cube as it's shown, so the moves match how the user holds it.
    const shown = cubeAsShown(cube, orientation.current)
    const solver = getSolver()
    setSolve({
      cube,
      status: { stage: 'solving', starting: !solver.isReady() },
    })
    let result: SolveStage
    try {
      result = {
        stage: 'solved',
        moves: await solver.solve(toFaceletString(shown)),
        front: shown[cellIndex('F', CENTER)]!,
        top: shown[cellIndex('U', CENTER)]!,
      }
    } catch (error) {
      result = { stage: 'failed', message: solverErrorMessage(error) }
    }
    // Ignore the answer if Solve was pressed again on another cube meanwhile.
    setSolve((current) =>
      current?.cube === cube ? { cube, status: result } : current,
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Rubik's Cube Solver</h1>
      </header>
      <Palette
        selected={color}
        counts={colorCounts(cube)}
        onSelect={setColor}
      />
      {status ? (
        <SolveStatus status={status} onClose={() => setSolve(null)} />
      ) : (
        <p className="hint">
          Pick a colour, then tap squares to paint (tap again to clear). Swipe
          to turn the cube.
        </p>
      )}
      <main className="cube-stage">
        <CubeView
          state={cube}
          onCellTap={(cell) => dispatch({ type: 'paint', cell, color })}
          highlight={
            validation && !validation.valid ? validation.cells : undefined
          }
          onOrientationChange={(turned) => {
            orientation.current = turned
          }}
        />
      </main>
      <nav className="toolbar" aria-label="Editing">
        <button
          type="button"
          onClick={() => dispatch({ type: 'undo' })}
          disabled={history.length === 0}
        >
          Undo
        </button>
        <button
          type="button"
          title="Paint the six centre squares in the standard colours: white on top, green in front"
          onClick={() => dispatch({ type: 'fillCenters' })}
          disabled={centersFilled(cube)}
        >
          Fill centres
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'reset' })}
          disabled={cube.every((cell) => cell === null)}
        >
          Reset
        </button>
      </nav>
      <button
        type="button"
        className="solve-button"
        onClick={handleSolve}
        disabled={status?.stage === 'solving'}
      >
        {status?.stage === 'solving' ? 'Solving…' : 'Solve'}
      </button>
    </div>
  )
}

export default App
