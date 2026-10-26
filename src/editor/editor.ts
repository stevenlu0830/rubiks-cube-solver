import {
  CENTER,
  cellIndex,
  emptyState,
  FACES,
  STANDARD_SCHEME,
  type Color,
  type CubeState,
} from '../cube/state.ts'

/**
 * Everything the user can do while colouring in the cube, written as a
 * "reducer": a function that takes the current state and an action, and
 * returns the next state without changing the old one. Keeping old states
 * untouched is what makes Undo easy: just go back to the previous one.
 */

/** Undo steps kept; older ones are dropped. */
const HISTORY_LIMIT = 200

export interface EditorState {
  cube: CubeState
  /** Earlier versions of `cube`, oldest first, for Undo. */
  history: CubeState[]
}

export type EditorAction =
  /** Paint a cell; painting a cell the colour it already has clears it. */
  | { type: 'paint'; cell: number; color: Color }
  /** Set the six centres to the standard colour scheme. */
  | { type: 'fillCenters' }
  /** Clear every cell. */
  | { type: 'reset' }
  | { type: 'undo' }

export function initialEditorState(
  cube: CubeState = emptyState(),
): EditorState {
  return { cube, history: [] }
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case 'paint': {
      const cube = [...state.cube]
      cube[action.cell] =
        cube[action.cell] === action.color ? null : action.color
      return change(state, cube)
    }
    case 'fillCenters': {
      const cube = [...state.cube]
      for (const face of FACES) {
        cube[cellIndex(face, CENTER)] = STANDARD_SCHEME[face]
      }
      return change(state, cube)
    }
    case 'reset':
      return change(state, emptyState())
    case 'undo':
      if (state.history.length === 0) return state
      return {
        cube: state.history.at(-1)!,
        history: state.history.slice(0, -1),
      }
  }
}

/** Moves to `cube`, remembering the current cube for Undo. */
function change(state: EditorState, cube: CubeState): EditorState {
  // Actions that change nothing (e.g. Reset on a blank cube) don't add an undo step.
  if (cube.every((cell, i) => cell === state.cube[i])) return state
  return {
    cube,
    history: [...state.history, state.cube].slice(-HISTORY_LIMIT),
  }
}

/** True when the six centres already match the standard colour scheme. */
export function centersFilled(cube: CubeState): boolean {
  return FACES.every(
    (face) => cube[cellIndex(face, CENTER)] === STANDARD_SCHEME[face],
  )
}
