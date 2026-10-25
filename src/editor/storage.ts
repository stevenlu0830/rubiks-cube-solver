import { COLORS, type CubeState } from '../cube/state.ts'

/**
 * Saves the painted cube in the browser (localStorage), so a page refresh
 * doesn't wipe the user's work. Storage can be missing or full (e.g. some
 * private browsing modes), so failures are silently ignored: the app then
 * simply starts blank.
 */

const STORAGE_KEY = 'rubiks-cube-solver/cube'

export function saveCube(
  cube: CubeState,
  storage: Storage = localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(cube))
  } catch {
    // Not saved; the app keeps working without it.
  }
}

/** The saved cube, or null if there is none or it's unreadable. */
export function loadCube(storage: Storage = localStorage): CubeState | null {
  try {
    const saved: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')
    return isCubeState(saved) ? saved : null
  } catch {
    return null
  }
}

/** Checks saved data really is 54 colours-or-blanks before trusting it. */
function isCubeState(value: unknown): value is CubeState {
  return (
    Array.isArray(value) &&
    value.length === 54 &&
    value.every(
      (cell) => cell === null || (COLORS as readonly unknown[]).includes(cell),
    )
  )
}
