import { useSyncExternalStore } from 'react'

/**
 * Which page to show, read from the end of the address after the # (its
 * "hash"): …/#/3x3 is the 3x3 solver, and anything else is the page for
 * picking a cube.
 *
 * Hash addresses need no help from the web server. The browser never sends
 * the part after # to it, so GitHub Pages (which has no way to send
 * index.html for any address) and the offline copy (public/sw.js) both
 * just serve the one page. Changing the hash doesn't reload the page, and
 * the browser's Back button steps through hashes like any other page.
 */

export const CUBE_TYPES = ['2x2', '3x3'] as const
export type CubeType = (typeof CUBE_TYPES)[number]

/** The cubes that can be solved so far; the picker shows the others as "Coming soon". */
export const READY_CUBES: readonly CubeType[] = ['3x3']

export type Route = 'picker' | CubeType

export const APP_NAME = "Rubik's Cube Solver"

export function routeFromHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '')
  return READY_CUBES.find((cube) => cube === name) ?? 'picker'
}

/** The address (from the # on) that shows this page. */
export function hashFor(route: Route): string {
  return route === 'picker' ? '#/' : `#/${route}`
}

/** The text for the browser tab, and for bookmarks and history. */
export function pageTitle(route: Route): string {
  return route === 'picker' ? APP_NAME : `${route} · ${APP_NAME}`
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** The page the address points to, kept up to date as the address changes. */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => routeFromHash(location.hash))
}
