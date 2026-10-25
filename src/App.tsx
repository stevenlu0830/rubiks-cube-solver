import { useEffect, useReducer, useState } from 'react'
import type { Color } from './cube/state.ts'
import {
  centersFilled,
  colorCounts,
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
      <p className="hint">
        Pick a colour, then tap squares to paint them. Tap again to clear.
      </p>
      <main className="cube-stage">
        <CubeView
          state={cube}
          onCellTap={(cell) => dispatch({ type: 'paint', cell, color })}
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
    </div>
  )
}

export default App
