import { describe, expect, it } from 'vitest'
import {
  applyMove,
  applyMoves,
  invertMove,
  invertMoves,
  parseMoves,
} from '../cube/moves.ts'
import { isSolved, solvedState } from '../cube/state.ts'
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
} from './playback.ts'

// A scrambled cube and a solution for it (the scramble undone).
const scramble = parseMoves("R U2 F' L D B2 R'")
const start = applyMoves(solvedState(), scramble)
const moves = invertMoves(scramble)

const run = (actions: PlaybackAction[], state: Playback) =>
  actions.reduce(playbackReducer, state)
const fresh = () => startPlayback(start, moves, 'green', 'white')
const ready = () => run([{ type: 'ready' }], fresh())

/** Presses Next (or Back) and lets the animation finish, checking it matches the jump in state. */
function stepWith(type: 'next' | 'previous', state: Playback): Playback {
  const turning = playbackReducer(state, { type })
  expect(turning.turning).not.toBeNull()
  const done = playbackReducer(turning, { type: 'turnDone' })
  // The animated move takes the cube shown before exactly to the cube shown after.
  expect(cubeAt(done)).toEqual(applyMove(cubeAt(state), turning.turning!.move))
  return done
}

describe('playback', () => {
  it('starts at the scrambled cube, waiting for the user to get ready', () => {
    const state = fresh()
    expect(cubeAt(state)).toEqual(start)
    expect(state.ready).toBe(false)
    expect(run([{ type: 'next' }, { type: 'play' }], state)).toEqual(state)
  })

  it('plays the whole solution forwards and ends solved', () => {
    let state = ready()
    for (let i = 0; i < moves.length; i++) {
      expect(isFinished(state)).toBe(false)
      expect(playbackReducer(state, { type: 'next' }).turning?.move).toBe(
        moves[i],
      )
      state = stepWith('next', state)
    }
    expect(isFinished(state)).toBe(true)
    expect(isSolved(cubeAt(state))).toBe(true)
    expect(playbackReducer(state, { type: 'next' })).toEqual(state)
  })

  it('plays the whole solution backwards, each move in reverse, back to the start', () => {
    let state = run([{ type: 'jump', step: moves.length }], ready())
    for (let i = moves.length - 1; i >= 0; i--) {
      expect(playbackReducer(state, { type: 'previous' }).turning?.move).toBe(
        invertMove(moves[i]),
      )
      state = stepWith('previous', state)
    }
    expect(state.step).toBe(0)
    expect(cubeAt(state)).toEqual(start)
    expect(playbackReducer(state, { type: 'previous' })).toEqual(state)
  })

  it('shows the move being animated as the current step, going either way', () => {
    const forwards = run([{ type: 'jump', step: 2 }, { type: 'next' }], ready())
    expect(currentStep(forwards)).toBe(2) // doing move 3 (index 2)
    const fromEnd = run(
      [{ type: 'jump', step: moves.length }, { type: 'previous' }],
      ready(),
    )
    expect(isFinished(fromEnd)).toBe(false)
    expect(currentStep(fromEnd)).toBe(moves.length - 1) // undoing the last move
    expect(currentStep(run([{ type: 'turnDone' }], fromEnd))).toBe(
      moves.length - 1,
    )
  })

  it('ignores Next and Back while a turn is animating', () => {
    const turning = run([{ type: 'next' }], ready())
    expect(run([{ type: 'next' }, { type: 'previous' }], turning)).toEqual(
      turning,
    )
  })

  it('jumps straight to any step, showing the start plus the moves so far', () => {
    const state = run([{ type: 'next' }, { type: 'jump', step: 4 }], ready())
    expect(state.step).toBe(4)
    expect(state.turning).toBeNull()
    expect(cubeAt(state)).toEqual(applyMoves(start, moves.slice(0, 4)))
    expect(run([{ type: 'jump', step: 99 }], state).step).toBe(moves.length)
  })

  it('keeps playing after each turn until the end, then stops', () => {
    let state = run([{ type: 'play' }], ready())
    expect(state.playing).toBe(true)
    expect(state.turning?.move).toBe(moves[0])
    for (let i = 0; i < moves.length; i++) {
      state = run([{ type: 'turnDone' }], state)
      if (i < moves.length - 1) {
        expect(state.playing).toBe(true)
        state = run([{ type: 'next' }], state) // what the app's timer does
      }
    }
    expect(state.playing).toBe(false)
    expect(isFinished(state)).toBe(true)
  })

  it('stops playing when paused, or when the user goes back or jumps', () => {
    const playing = run([{ type: 'play' }, { type: 'turnDone' }], ready())
    expect(run([{ type: 'pause' }], playing).playing).toBe(false)
    expect(run([{ type: 'previous' }], playing).playing).toBe(false)
    expect(run([{ type: 'jump', step: 0 }], playing).playing).toBe(false)
  })

  it('turns faster at higher speeds', () => {
    const state = run([{ type: 'speed', speed: 2 }], ready())
    expect(state.speed).toBe(2)
    expect(turnDurationMs(2)).toBeLessThan(turnDurationMs(1))
    expect(pauseMs(0.5)).toBeGreaterThan(pauseMs(1))
  })
})
