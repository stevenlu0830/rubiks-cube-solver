import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { Quaternion } from 'three'
import {
  CENTER,
  cellIndex,
  colorCounts,
  type Color,
  type CubeState,
} from './cube/state.ts'
import { validateCube } from './cube/validate.ts'
import { buzz, type Buzz } from './device/haptics.ts'
import {
  centersFilled,
  editorReducer,
  initialEditorState,
} from './editor/editor.ts'
import { Palette } from './editor/Palette.tsx'
import { SolveStatus, type SolveStage } from './editor/SolveStatus.tsx'
import { loadCube, saveCube } from './editor/storage.ts'
import {
  loadSettings,
  saveSettings,
  type Settings,
} from './settings/settings.ts'
import { SettingsMenu } from './settings/SettingsMenu.tsx'
import { CubeNet } from './solve/CubeNet.tsx'
import { turnedFace } from './solve/moveGuide.ts'
import {
  cubeAt,
  currentStep,
  isFinished,
  pauseMs,
  playbackReducer,
  startPlayback,
  turnDurationMs,
  type Playback,
  type PlaybackAction,
} from './solve/playback.ts'
import { PlaybackControls } from './solve/PlaybackControls.tsx'
import { SolveCard } from './solve/SolveCard.tsx'
import { StepList } from './solve/StepList.tsx'
import { toFaceletString } from './solver/facelets.ts'
import { getSolver, solverErrorMessage } from './solver/solver.ts'
import { CubeView } from './view/CubeView.tsx'
import { cubeAsShown } from './view/orientation.ts'
import './App.css'
import './solve/solve.css'

/** Everything after pressing Solve: a check result, waiting, or stepping through the solution. */
type Solve = SolveStage | { stage: 'playing'; playback: Playback }

function App() {
  const [{ cube, history }, dispatch] = useReducer(
    editorReducer,
    undefined,
    () => initialEditorState(loadCube() ?? undefined),
  )
  const [color, setColor] = useState<Color>('white')
  const [settings, setSettings] = useState(loadSettings)
  /** Which way round the cube is shown; the solve uses it as the holding position. */
  const orientation = useRef(new Quaternion())
  const [solve, setSolve] = useState<{ cube: CubeState; status: Solve } | null>(
    null,
  )
  // A solve only applies to the cube it was for: any edit hides it.
  const status = solve?.cube === cube ? solve.status : null
  const validation = status?.stage === 'checked' ? status.validation : null
  const playback = status?.stage === 'playing' ? status.playback : null
  /** The message shown while painting: anything short of a solution. */
  const message = status?.stage === 'playing' ? null : status

  const dispatchPlayback = useCallback((action: PlaybackAction) => {
    setSolve((current) =>
      current?.status.stage === 'playing'
        ? {
            ...current,
            status: {
              stage: 'playing',
              playback: playbackReducer(current.status.playback, action),
            },
          }
        : current,
    )
  }, [])

  useEffect(() => {
    saveCube(cube)
  }, [cube])

  function changeSettings(changed: Settings) {
    setSettings(changed)
    saveSettings(changed)
  }

  /** A buzz the user can feel, unless they've turned vibration off. */
  function feel(kind: Buzz) {
    if (settings.haptics) buzz(kind)
  }

  // Start the solver's setup now, so it's ready by the time the cube is painted.
  useEffect(() => {
    getSolver()
  }, [])

  // While playing, start the next turn after a short pause.
  const waitingToPlay =
    playback !== null &&
    playback.playing &&
    !playback.turning &&
    !isFinished(playback)
  const speed = playback?.speed ?? 1
  useEffect(() => {
    if (!waitingToPlay) return
    const timer = setTimeout(
      () => dispatchPlayback({ type: 'next' }),
      pauseMs(speed),
    )
    return () => clearTimeout(timer)
  }, [waitingToPlay, speed, dispatchPlayback])

  const shownCube = useMemo(
    () => (playback ? cubeAt(playback) : cube),
    [playback, cube],
  )
  const nextMove =
    playback && playback.ready && !isFinished(playback)
      ? playback.moves[currentStep(playback)]
      : null

  async function handleSolve() {
    const validation = validateCube(cube)
    if (!validation.valid || validation.solved) {
      setSolve({ cube, status: { stage: 'checked', validation } })
      if (!validation.valid) feel('problem')
      return
    }

    // Read the cube as it's shown, so the moves match how the user holds it.
    const shown = cubeAsShown(cube, orientation.current)
    const solver = getSolver()
    setSolve({
      cube,
      status: { stage: 'solving', starting: !solver.isReady() },
    })
    let result: Solve
    try {
      const moves = await solver.solve(toFaceletString(shown))
      result = {
        stage: 'playing',
        playback: startPlayback(
          shown,
          moves,
          shown[cellIndex('F', CENTER)]!,
          shown[cellIndex('U', CENTER)]!,
        ),
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
      <header
        className={playback ? 'app-header app-header-solving' : 'app-header'}
      >
        <div className="header-side">
          {playback && (
            <button
              type="button"
              className="header-button"
              onClick={() => setSolve(null)}
            >
              ‹ Edit cube
            </button>
          )}
        </div>
        <h1>Rubik's Cube Solver</h1>
        <div className="header-side header-side-end">
          <SettingsMenu settings={settings} onChange={changeSettings} />
        </div>
      </header>

      {playback ? (
        <SolveCard
          playback={playback}
          onReady={() => dispatchPlayback({ type: 'ready' })}
          onWatchAgain={() => dispatchPlayback({ type: 'jump', step: 0 })}
          onSolveAnother={() => {
            setSolve(null)
            dispatch({ type: 'reset' })
          }}
          map={
            <CubeNet
              state={shownCube}
              activeFace={nextMove && turnedFace(nextMove)}
            />
          }
        />
      ) : (
        <>
          <Palette
            selected={color}
            counts={colorCounts(cube)}
            onSelect={setColor}
            letters={settings.letters}
          />
          {message ? (
            <SolveStatus status={message} onClose={() => setSolve(null)} />
          ) : (
            <p className="hint">
              Pick a colour, then tap squares to paint (tap again to clear).
              Swipe to turn the cube.
            </p>
          )}
        </>
      )}

      {/* Stays in the same place in both modes, so the 3D view isn't rebuilt. */}
      <main className="cube-stage">
        <CubeView
          state={shownCube}
          onCellTap={(cell) => {
            dispatch({ type: 'paint', cell, color })
            feel('tap')
          }}
          highlight={
            validation && !validation.valid ? validation.cells : undefined
          }
          onOrientationChange={(turned) => {
            orientation.current = turned
          }}
          disabled={status?.stage === 'solving'}
          held={playback !== null}
          turn={playback?.turning?.move ?? null}
          turnDurationMs={turnDurationMs(speed)}
          onTurnDone={() => {
            dispatchPlayback({ type: 'turnDone' })
            const done = playback?.turning?.to
            if (done !== undefined && done === playback?.moves.length) {
              feel('solved')
            }
          }}
          hint={nextMove}
          letters={settings.letters}
        />
      </main>

      {playback ? (
        <>
          <PlaybackControls playback={playback} dispatch={dispatchPlayback} />
          <StepList
            playback={playback}
            onJump={(step) => dispatchPlayback({ type: 'jump', step })}
          />
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}

export default App
