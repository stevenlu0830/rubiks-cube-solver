import {
  isFinished,
  SPEEDS,
  type Playback,
  type PlaybackAction,
} from './playback.ts'

interface PlaybackControlsProps {
  playback: Playback
  dispatch: (action: PlaybackAction) => void
}

/** Back, Play/Pause, Next, and the playing speed. */
export function PlaybackControls({
  playback,
  dispatch,
}: PlaybackControlsProps) {
  const { ready, step, playing, speed } = playback
  const finished = isFinished(playback)
  const nextSpeed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]

  return (
    <nav className="playback-controls" aria-label="Playback">
      <button
        type="button"
        onClick={() => dispatch({ type: 'previous' })}
        disabled={!ready || step === 0}
      >
        Back
      </button>
      <button
        type="button"
        className="primary-button"
        onClick={() => dispatch({ type: playing ? 'pause' : 'play' })}
        disabled={!ready || (finished && !playing)}
      >
        {playing ? 'Pause' : 'Play'}
      </button>
      <button
        type="button"
        onClick={() => dispatch({ type: 'next' })}
        disabled={!ready || finished}
      >
        Next
      </button>
      <button
        type="button"
        aria-label={`Speed ${speed}×, tap for ${nextSpeed}×`}
        onClick={() => dispatch({ type: 'speed', speed: nextSpeed })}
      >
        {speed}×
      </button>
    </nav>
  )
}
