/**
 * Offline support: registers the service worker (public/sw.js), which saves
 * a copy of the app on the phone after the first visit. Then it opens and
 * solves without internet, and can be added to the home screen like an
 * installed app ("Add to Home Screen" on iPhone, "Install app" on Android).
 *
 * Only in the built app: during development, saved copies would hide the
 * changes being made.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // No offline copy this time; the app still works online.
    })
  })
}
