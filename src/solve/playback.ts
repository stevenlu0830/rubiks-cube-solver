import { applyMoves, invertMove, type Move } from '../cube/moves.ts'
import type { Color, CubeState } from '../cube/state.ts'

/**
 * Stepping through a solution, written as a reducer like the editor: each
 * action (Next, Previous, Play…) turns one playback state into the next.
 *
 * The cube shown is always worked out from the start plus the moves done so
 * far, so jumping to any step is instant and can never get out of step.
 */

export const SPEEDS = [0.5, 1, 2] as const
export type Speed = (typeof SPEEDS)[number]

export interface Playback {
  /** The cube as the user holds it, before any moves. */
  start: CubeState
  moves: Move[]
  /** Centre colours facing the user and on top: how to hold the cube. */
  front: Color
  top: Color
  /** Whether the user has confirmed they're holding their cube that way. */
  ready: boolean
  /** How many moves are done; moves[step] is the one to do next. */
  step: number
  /** The move being animated, and the step it leads to. */
  turning: { move: Move; to: number } | null
  playing: boolean
  speed: Speed
}

export type PlaybackAction =
  | { type: 'ready' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'jump'; step: number }
  /** The 3D cube finished animating `turning`. */
  | { type: 'turnDone' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'speed'; speed: Speed }

export function startPlayback(
  start: CubeState,
  moves: Move[],
  front: Color,
  top: Color,
): Playback {
  return {
    start,
    moves,
    front,
    top,
    ready: false,
    step: 0,
    turning: null,
    playing: false,
    speed: 1,
  }
}

export function playbackReducer(
  state: Playback,
  action: PlaybackAction,
): Playback {
  const done = state.step >= state.moves.length
  // Nothing moves until the user is holding their cube, nor while a turn animates.
  const idle = state.ready && !state.turning
  switch (action.type) {
    case 'ready':
      return { ...state, ready: true }
    case 'next':
      return idle && !done ? withNextTurn(state) : state
    case 'previous':
      if (!idle || state.step === 0) return state
      return {
        ...state,
        playing: false,
        // Going back plays the last move done in reverse.
        turning: {
          move: invertMove(state.moves[state.step - 1]),
          to: state.step - 1,
        },
      }
    case 'jump':
      if (!state.ready) return state
      return {
        ...state,
        step: Math.max(0, Math.min(action.step, state.moves.length)),
        turning: null,
        playing: false,
      }
    case 'turnDone': {
      if (!state.turning) return state
      const step = state.turning.to
      return {
        ...state,
        step,
        turning: null,
        playing: state.playing && step < state.moves.length,
      }
    }
    case 'play':
      if (!state.ready || done) return state
      return state.turning
        ? { ...state, playing: true }
        : withNextTurn({ ...state, playing: true })
    case 'pause':
      return { ...state, playing: false }
    case 'speed':
      return { ...state, speed: action.speed }
  }
}

function withNextTurn(state: Playback): Playback {
  return {
    ...state,
    turning: { move: state.moves[state.step], to: state.step + 1 },
  }
}

/** The cube after the moves done so far. */
export function cubeAt(state: Playback): CubeState {
  return applyMoves(state.start, state.moves.slice(0, state.step))
}

/**
 * The step to show as current: the move being animated (going forwards, the
 * one being done; going back, the one being undone), or else the next move.
 */
export function currentStep(state: Playback): number {
  return state.turning ? Math.min(state.step, state.turning.to) : state.step
}

/** True once every move has been done. */
export function isFinished(state: Playback): boolean {
  return state.step >= state.moves.length && !state.turning
}

/** How long one face turn takes to animate at this speed. */
export function turnDurationMs(speed: Speed): number {
  return 500 / speed
}

/** The pause between turns while playing. */
export function pauseMs(speed: Speed): number {
  return 400 / speed
}
