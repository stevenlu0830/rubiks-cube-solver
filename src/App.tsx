import { useEffect, useReducer, useState } from 'react'
import { colorCounts, type Color, type CubeState } from './cube/state.ts'
import { validateCube, type Validation } from './cube/validate.ts'
import { CheckResult } from './editor/CheckResult.tsx'
import {
  centersFilled,
  editorReducer,
  initialEditorState,
} from './editor/editor.ts'
import { Palette } from './editor/Palette.tsx'
import { loadCube, saveCube } from './editor/storage.ts'
import { CubeView } from './view/CubeView.tsx'
import './App.css'

function App() {
  const [{ cube, history }, dispatch] = useReducer(
    editorReducer,
    undefined,
    () => initialEditorState(loadCube() ?? undefined),
  )
  const [color, setColor] = useState<Color>('white')
  const [check, setCheck] = useState<{
    cube: CubeState
    result: Validation
  } | null>(null)
  // A check result only applies to the cube it checked: any edit hides it.
  const result = check?.cube === cube ? check.result : null

  useEffect(() => {
    saveCube(cube)
  }, [cube])

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
      {result ? (
        <CheckResult result={result} onClose={() => setCheck(null)} />
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
          highlight={result && !result.valid ? result.cells : undefined}
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
        onClick={() => setCheck({ cube, result: validateCube(cube) })}
      >
        Solve
      </button>
    </div>
  )
}

export default App
