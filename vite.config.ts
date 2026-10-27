import react from '@vitejs/plugin-react'
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
          exclude: [...configDefaults.exclude, '**/*.slow.test.ts'],
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
