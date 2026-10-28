/**
 * The user's choices from the settings menu, saved in the browser like the
 * cube (see editor/storage.ts), so they stay set after a refresh.
 */

export interface Settings {
  /** Write each sticker's colour letter on it (W, Y, G…), for colour-blind users. */
  letters: boolean
  /** Buzz on taps and results, on phones that can (see device/haptics.ts). */
  haptics: boolean
}

export const DEFAULT_SETTINGS: Settings = { letters: false, haptics: true }

const STORAGE_KEY = 'rubiks-cube-solver/settings'

export function saveSettings(
  settings: Settings,
  storage: Storage = localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Not saved; the settings still apply until the page is closed.
  }
}

/** The saved settings; anything missing or unreadable is left at its default. */
export function loadSettings(storage: Storage = localStorage): Settings {
  let saved: unknown
  try {
    saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    return DEFAULT_SETTINGS
  }
  const settings = { ...DEFAULT_SETTINGS }
  if (typeof saved === 'object' && saved !== null) {
    for (const key of Object.keys(settings) as (keyof Settings)[]) {
      const value: unknown = (saved as Record<string, unknown>)[key]
      if (typeof value === 'boolean') settings[key] = value
    }
  }
  return settings
}
