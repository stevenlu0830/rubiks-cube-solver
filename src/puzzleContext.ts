import { createContext, useContext } from 'react'
import { PUZZLE_3X3, type Puzzle } from './cube/puzzle.ts'

/**
 * Which cube the page is for (see cube/puzzle.ts), for any component that
 * needs its size: the 3D view, the palette's counts, the map of all six
 * sides. React "context" hands a value down to every component inside the
 * provider, so it doesn't have to be passed to each one as a prop.
 *
 * SolverPage provides it. Outside one, it's a 3x3.
 */
export const PuzzleContext = createContext<Puzzle>(PUZZLE_3X3)

/** The cube the page is for. */
export function usePuzzle(): Puzzle {
  return useContext(PuzzleContext)
}
