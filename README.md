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
| `npm run dev:phone` | Same, but reachable from a phone on the same Wi-Fi, over https:// so the camera works (see below)    |
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

1. `npm run dev:phone`, then open the Network URL it prints (`https://192.168…`) on your phone (same Wi-Fi). Phones only let https:// pages use the camera, so this serves the app with a home-made security certificate, and the phone warns about it the first time. That's expected for your own computer: on iPhone tap **Show Details → visit this website**; on Android tap **Advanced → Proceed**.
2. Add `?fps` to the end of the address to show the frame rate in the corner. Turns should stay near 60 fps (or 120 on some phones), and "slowest" should stay under about 20 ms.
3. On the published site, **Add to Home Screen** (iPhone, from the Share menu) or **Install app** (Android Chrome) to use it like an app. After the first visit it also works with no internet.

**Scan** (next to Solve) reads the cube with the back camera instead of tapping in every square:

1. Line one side of your cube up in the grid. Dots show the colours it reads, live, with a warning if it's too dark, there's shine on the stickers, or the phone is moving. Tap **Take photo**: the colours appear on the photo and on the 3D cube. Squares it's unsure of get a dashed yellow ring; tap any square to pick its colour yourself, or tap **Retake**.
2. Tap **Next side**. The 3D cube turns to the next side, and the app says how to turn yours to match, e.g. "Turn your cube to the left, so its right side faces you". All six sides take five turns. You can also swipe the 3D cube to any side yourself.
3. After the sixth side, tap **Done**, check the cube, fix any square by tapping it, and tap **Solve**.

After each photo the app shares the colours out over every side scanned so far, so no colour gets more than 9 squares (a real cube has 9 of each). That sorts out most red/orange and white/yellow mix-ups, and can change squares on earlier sides, but never ones you picked yourself. If a photo looks like a side you've already scanned, it says so: your real cube was probably turned differently from the 3D one.

To collect test data from real photos, add `?scan-debug` to the address: see [src/scan/test-photos/README.md](src/scan/test-photos/README.md).

The camera switches off when you tap **Done** or switch to another app.

The ⚙ menu has **Letters on stickers** (W, Y, G, B, R, O, for telling colours apart) and, on phones that can vibrate, **Vibration**.

## Deployment

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): lint, format check, tests, build, end-to-end tests, then publish to GitHub Pages at `https://stevenlu0830.github.io/rubiks-cube-solver/`.

One-time setup: in the GitHub repo, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
