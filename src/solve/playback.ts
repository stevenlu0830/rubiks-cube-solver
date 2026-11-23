import { applyMoves, invertMove, type Move } from '../cube/moves.ts'
import type { CubeState } from '../cube/state.ts'
import type { Stage } from '../solver/protocol.ts'
import { holdFor, type Hold } from './hold.ts'

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
  /**
   * A 4x4's solution comes in stages (centres, edges…), each with a
   * checkpoint at its end where Play stops. A 2x2 or 3x3 has none.
   */
  stages: readonly Stage[]
  /** How to hold the cube for every step, worked out from `start`. */
  hold: Hold
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

/** Ready to step through `moves`, starting from the cube as the user holds it. */
export function startPlayback(
  start: CubeState,
  moves: Move[],
  stages: readonly Stage[] = [],
): Playback {
  return {
    start,
    moves,
    stages,
    hold: holdFor(start),
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
        // Play stops at the end of each stage, for the user to check their cube.
        playing:
          state.playing &&
          step < state.moves.length &&
          !state.stages.some(({ start }) => start === step),
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

/** The stage that `step` is part of, if the solution has stages. */
export function stageOf(state: Playback, step: number): Stage | null {
  return state.stages.findLast(({ start }) => start <= step) ?? null
}

/**
 * The stage just finished, while waiting at its checkpoint: every move of
 * it done, and the next stage's first move not yet started. Null otherwise.
 */
export function finishedStage(state: Playback): Stage | null {
  if (!state.ready || state.turning || isFinished(state)) return null
  const next = state.stages.findIndex(({ start }) => start === state.step)
  return next > 0 ? state.stages[next - 1] : null
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
