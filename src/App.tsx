import { useState } from 'react'
import { applyMoves, randomScramble } from './cube/moves.ts'
import { emptyState, solvedState, type CubeState } from './cube/state.ts'
import { CubeView } from './view/CubeView.tsx'
import './App.css'

const scrambled = () => applyMoves(solvedState(), randomScramble())

// Temporary buttons for trying out the 3D view, until the colour palette
// replaces them in Phase 3.
const PREVIEWS: { label: string; make: () => CubeState }[] = [
  { label: 'Blank', make: emptyState },
  { label: 'Solved', make: () => solvedState() },
  { label: 'Scrambled', make: scrambled },
  {
    label: 'Half painted',
    make: () => scrambled().map((cell) => (Math.random() < 0.5 ? null : cell)),
  },
]

function App() {
  const [cube, setCube] = useState<CubeState>(emptyState)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Rubik's Cube Solver</h1>
      </header>
      <main className="cube-stage">
        <CubeView state={cube} />
      </main>
      <nav className="preview-bar" aria-label="Preview states">
        {PREVIEWS.map(({ label, make }) => (
          <button key={label} type="button" onClick={() => setCube(make())}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
