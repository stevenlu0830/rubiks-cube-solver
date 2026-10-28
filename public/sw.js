// The service worker: a small script the browser keeps running beside the
// app, which can answer the app's requests for files itself. This one keeps
// a copy of every file the app needs, so after one visit it opens and solves
// with no internet. See src/device/offline.ts.

// Filled in by the build (see offlineFiles in vite.config.ts). The version
// changes whenever any file does, which is how phones notice an update.
const VERSION = 'dev'
const FILES = []

const CACHE = `rubiks-cube-solver-${VERSION}`

// A new version: download all its files first.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)))
})

// Taking over from an older version (once every tab of it has closed):
// delete the older files.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('rubiks-cube-solver-'))
          .filter((key) => key !== CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const sameSite = new URL(request.url).origin === self.location.origin
  if (request.method !== 'GET' || !sameSite) return

  if (request.mode === 'navigate') {
    // The page itself: get the newest one, or the saved copy when offline.
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('index.html', { ignoreSearch: true }),
      ),
    )
    return
  }
  // Everything else has a fingerprint in its name (index-3f2a1b.js), so a
  // saved copy is never out of date. ignoreVary: some servers mark files as
  // varying by who asked for them, which would make the saved copy miss.
  event.respondWith(
    caches
      .match(request, { ignoreVary: true })
      .then((saved) => saved ?? fetch(request)),
  )
})
