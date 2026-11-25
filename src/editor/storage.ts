import {
  PUZZLE_3X3,
  puzzleOf,
  type CubeType,
  type Puzzle,
} from '../cube/puzzle.ts'
import { COLORS, type CubeState } from '../cube/state.ts'

/**
 * Saves the painted cube in the browser (localStorage), so a page refresh
 * doesn't wipe the user's work. Storage can be missing or full (e.g. some
 * private browsing modes), so failures are silently ignored: the app then
 * simply starts blank.
 *
 * Each cube is saved in its own place, so painting a 2x2 never wipes a 3x3,
 * a 4x4 or a 5x5, and the other way round.
 */

const STORAGE_KEYS: Readonly<Record<CubeType, string>> = {
  // The name from before the app had a 2x2, so cubes saved then still load.
  '3x3': 'rubiks-cube-solver/cube',
  '2x2': 'rubiks-cube-solver/cube-2x2',
  '4x4': 'rubiks-cube-solver/cube-4x4',
  '5x5': 'rubiks-cube-solver/cube-5x5',
}

/** Saves a 2x2, 3x3, 4x4 or 5x5 (told apart by how many cells it has) in its own place. */
export function saveCube(
  cube: CubeState,
  storage: Storage = localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEYS[puzzleOf(cube).name], JSON.stringify(cube))
  } catch {
    // Not saved; the app keeps working without it.
  }
}

/** The saved cube of this kind, or null if there is none or it's unreadable. */
export function loadCube(
  storage: Storage = localStorage,
  puzzle: Puzzle = PUZZLE_3X3,
): CubeState | null {
  try {
    const saved: unknown = JSON.parse(
      storage.getItem(STORAGE_KEYS[puzzle.name]) ?? 'null',
    )
    return isCubeState(saved, puzzle) ? saved : null
  } catch {
    return null
  }
}

/** Checks saved data really is the right number of colours-or-blanks before trusting it. */
function isCubeState(value: unknown, puzzle: Puzzle): value is CubeState {
  return (
    Array.isArray(value) &&
    value.length === puzzle.cellCount &&
    value.every(
      (cell) => cell === null || (COLORS as readonly unknown[]).includes(cell),
    )
  )
}
