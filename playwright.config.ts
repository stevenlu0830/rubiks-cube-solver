import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests: real browsers, pretending to be phones, using the built
 * app the way a person would (tapping, swiping, reading the screen). They
 * test the production build, so run `npm run test:e2e`, which builds first.
 */
const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  // Painting 54 squares and playing a whole solution takes a while.
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'iPhone Safari', use: { ...devices['iPhone 15'] } },
    { name: 'Android Chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
})
