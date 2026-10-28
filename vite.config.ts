import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

/**
 * cubejs is old-style CommonJS code that finds its own Cube class through
 * `this.Cube`. That only works where `this` is the module's exports (as in
 * Node, so tests pass). Bundled for the browser, `this` is undefined and the
 * solver crashes as it loads, so drop that lookup and use require() directly.
 */
const fixCubejs = {
  name: 'fix-cubejs-this',
  transform(code: string, id: string) {
    if (!/node_modules[\\/]cubejs[\\/]lib[\\/]solve\.js$/.test(id)) return null
    const lookup = 'Cube = this.Cube || require('
    if (!code.includes(lookup)) {
      throw new Error('fix-cubejs-this: cubejs has changed; check this fix')
    }
    return code.replace(lookup, 'Cube = require(')
  },
}

/**
 * Tells the service worker (public/sw.js) which files to save for offline
 * use. Their names change with every build (index-3f2a1b.js), so once the
 * build has written them all, list them in the built sw.js, along with a
 * version that changes whenever any file's contents do.
 */
function offlineFiles(): Plugin {
  let outDir = ''
  return {
    name: 'offline-files',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const workerPath = join(outDir, 'sw.js')
      const files = readdirSync(outDir, { recursive: true, encoding: 'utf8' })
        .map((file) => file.replaceAll('\\', '/'))
        .filter((file) => file !== 'sw.js')
        .filter((file) => statSync(join(outDir, file)).isFile())
        .sort()
      const hash = createHash('sha256')
      for (const file of files) {
        hash.update(file).update(readFileSync(join(outDir, file)))
      }
      const version = hash.digest('hex').slice(0, 12)

      const placeholders = ["const VERSION = 'dev'", 'const FILES = []']
      const worker = readFileSync(workerPath, 'utf8')
      if (!placeholders.every((line) => worker.includes(line))) {
        throw new Error('offline-files: public/sw.js has changed; check this')
      }
      writeFileSync(
        workerPath,
        worker
          .replace(placeholders[0], `const VERSION = '${version}'`)
          .replace(placeholders[1], `const FILES = ${JSON.stringify(files)}`),
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlineFiles()],
  // Relative asset paths, so the build works at any URL path
  // (e.g. GitHub Pages serves it under /rubiks-cube-solver/).
  base: './',
  // The dev server pre-packages libraries like cubejs; fix it there too.
  optimizeDeps: { rolldownOptions: { plugins: [fixCubejs] } },
  // Build the solver's Web Worker as a modern JavaScript module.
  worker: { format: 'es', plugins: () => [fixCubejs] },
  test: {
    projects: [
      {
        // The everyday tests: `npm test`.
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          exclude: [
            ...configDefaults.exclude,
            '**/*.slow.test.ts',
            'e2e/**', // Playwright's, run by `npm run test:e2e`
          ],
        },
      },
      {
        // Long-running checks, e.g. solving 1,000 cubes: `npm run test:slow`.
        test: {
          name: 'slow',
          environment: 'node',
          include: ['src/**/*.slow.test.ts'],
          testTimeout: 180_000,
        },
      },
    ],
  },
})
