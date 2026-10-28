# rubiks-cube-solver

A mobile web app: paint a 3D Rubik's cube to match yours, then get animated step-by-step solving instructions.

Built with Vite, React and TypeScript.

## Getting started

Requires Node.js 20.19+ (CI uses Node 24).

```bash
npm install
npm run dev
```

## Scripts

| Command             | What it does                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run dev`       | Start the dev server on this computer                                                                |
| `npm run dev:phone` | Same, but reachable from a phone on the same Wi-Fi (use the Network URL it prints)                   |
| `npm test`          | Run the tests once (`npm run test:watch` to re-run on save)                                          |
| `npm run test:slow` | Run the long checks too, e.g. solving 1,000 random cubes (about 35 seconds)                          |
| `npm run test:e2e`  | Build, then test the whole app in real browsers posing as an iPhone and an Android phone (see below) |
| `npm run lint`      | Check the code for likely bugs with ESLint                                                           |
| `npm run format`    | Auto-format all files with Prettier                                                                  |
| `npm run build`     | Type-check and build the production site into `dist/`                                                |
| `npm run preview`   | Serve the built `dist/` locally                                                                      |

## End-to-end tests

[Playwright](https://playwright.dev) tests in [e2e/](e2e/) tap and swipe the built app in Safari's engine (WebKit) posing as an iPhone, and Chrome's posing as an Android phone: painting a cube, checking it, playing the solution, the settings menu, working offline, and automatic accessibility checks (including text contrast) in light and dark mode. The first time, download the browsers:

```bash
npx playwright install chromium webkit
```

These are copies of the browsers' engines, not real phones, so also try the app on a real phone (below).

## Trying it on a real phone

1. `npm run dev:phone`, then open the Network URL it prints on your phone (same Wi-Fi).
2. Add `?fps` to the end of the address to show the frame rate in the corner. Turns should stay near 60 fps (or 120 on some phones), and "slowest" should stay under about 20 ms.
3. On the published site, **Add to Home Screen** (iPhone, from the Share menu) or **Install app** (Android Chrome) to use it like an app. After the first visit it also works with no internet.

The ⚙ menu has **Letters on stickers** (W, Y, G, B, R, O, for telling colours apart) and, on phones that can vibrate, **Vibration**.

## Deployment

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): lint, format check, tests, build, end-to-end tests, then publish to GitHub Pages at `https://stevenlu0830.github.io/rubiks-cube-solver/`.

One-time setup: in the GitHub repo, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
