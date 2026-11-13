# rubiks-cube-solver

A mobile web app for solving a 2x2 or 3x3 Rubik's cube: paint a 3D cube to match yours, or scan it with your camera, then follow animated step-by-step solving instructions. After the first visit it works offline too.

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
| `npm run test:slow` | Run the long checks too, e.g. solving 1,000 random 3x3s and 1,000 random 2x2s (about 45 seconds)     |
| `npm run test:e2e`  | Build, then test the whole app in real browsers posing as an iPhone and an Android phone (see below) |
| `npm run lint`      | Check the code for likely bugs with ESLint                                                           |
| `npm run format`    | Auto-format all files with Prettier                                                                  |
| `npm run build`     | Type-check and build the production site into `dist/`                                                |
| `npm run preview`   | Serve the built `dist/` locally                                                                      |

The tests that `npm test` runs are in [test/](test/), in the same folders as the code they check in [src/](src/) (e.g. [test/cube/moves.test.ts](test/cube/moves.test.ts) checks [src/cube/moves.ts](src/cube/moves.ts)). Helpers shared by several tests, such as the fake camera, are in [test/helpers/](test/helpers/).

## End-to-end tests

[Playwright](https://playwright.dev) tests in [e2e/](e2e/) tap and swipe the built app in Safari's engine (WebKit) posing as an iPhone, and Chrome's posing as an Android phone. For both cubes: picking it, painting it, scanning it with a pretend camera, checking it, playing the solution, working offline, and automatic accessibility checks (including text contrast) in light and dark mode. Also the settings menu and the About window. The first time, download the browsers:

```bash
npx playwright install chromium webkit
```

These are copies of the browsers' engines, not real phones, so also try the app on a real phone (below).

## Trying it on a real phone

1. `npm run dev:phone`, then open the Network URL it prints (`https://192.168…`) on your phone (same Wi-Fi). Phones only let https:// pages use the camera, so this serves the app with a home-made security certificate, and the phone warns about it the first time. That's expected for your own computer: on iPhone tap **Show Details → visit this website**; on Android tap **Advanced → Proceed**.
2. Add `?fps` to the address to show the frame rate in the corner. It goes before any `#`: `https://192.168…:5173/?fps#/2x2` opens the 2x2 with it. Turns should stay near 60 fps (or 120 on some phones), and "slowest" should stay under about 20 ms. Try both cubes: swiping the cube round, the turns while playing a solution, and the scan screen, which shows the camera and the 3D cube at once.
3. Scan a real cube, a 2x2 especially, in the light you'd usually use it in (see [Scanning your cube](#scanning-your-cube)). Counting how many squares it gets wrong is the best test of the colour reading; adding `?scan-debug` records the photos so they can become tests.
4. On the published site, **Add to Home Screen** (iPhone, from the Share menu) or **Install app** (Android Chrome) to use it like an app. After the first visit it also works with no internet.

The ⓘ button opens a short **About** window: what the app does, what it's built with, and contact links. Fill those in, in [src/info/contacts.ts](src/info/contacts.ts); until then each shows "[placeholder]".

The ⚙ menu has **Letters on stickers** (W, Y, G, B, R, O, for telling colours apart), on phones that can vibrate **Vibration**, and where there's a camera **Auto photo** (see below).

## The 2x2 and the 3x3

The first page asks which cube you're solving. Each cube has its own page (`#/2x2` or `#/3x3` on the end of the address, so either can be bookmarked) and its own saved cube: a half-painted 3x3 waits, marked **In progress** on the first page, while you solve a 2x2. **‹ Cubes** goes back.

Both have the same features: tap colours onto the 3D cube or scan it, swipe to turn it round, **Undo** and **Reset**, then **Solve** and follow the moves step by step. Each cube's solver runs in the background (a Web Worker), so the page never freezes while it thinks. What differs:

|            | 3x3                                                                           | 2x2                                                                                                      |
| ---------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Painting   | **Fill centres** paints the six centres: white on top, green in front         | No centres, so no Fill centres                                                                           |
| Solver     | cubejs (Kociemba's two-phase method): at most 22 moves, after a one-off setup | Its own ([src/solver/twoByTwo.ts](src/solver/twoByTwo.ts)): always a shortest solution, at most 11 moves |
| Holding it | By its centres, which never move: which colour faces you, and which is on top | By the corner at the back, bottom left, which its solutions never move                                   |
| Scanning   | Names colours from each side's centre                                         | Learns its colours from its own photos (see below)                                                       |

## Scanning your cube

**Scan** (next to Solve) reads your cube with the camera instead of tapping in every square:

1. Hold one side of your cube up to the grid. Dots show the colours it reads, live, with a warning if it's too dark, there's shine on the stickers, or the phone is moving. Hold still for about half a second: the grid turns green and the photo takes itself. You can also tap **Take photo** any time, or switch **Auto photo** off in the ⚙ menu to only use the button. The colours appear on the photo and on the 3D cube. Squares it's unsure of get a dashed yellow ring; tap any square to pick its colour yourself, or tap **Retake**.
2. Tap **Next side**. The 3D cube turns to the next side, and the app says how to turn yours to match, e.g. "Turn your cube to the left, so its right side faces you". All six sides take five turns. You can also swipe the 3D cube to any side yourself.
3. After the sixth side, tap **Done**, check the cube, fix any square by tapping it, and tap **Solve**.

What helps it read your cube right:

- **9 of each colour** (4 on a 2x2). After each photo the app shares the colours out over every side scanned so far, so no colour gets more squares than a real cube has. That sorts out most red/orange and white/yellow mix-ups, and can change squares on earlier sides, but never ones you picked yourself.
- **A side scanned twice.** If a photo looks like a side you've already scanned, it says so: your real cube was probably turned differently from the 3D one. Auto photo won't take one; it waits until you've turned your cube.
- **A side held turned.** If a side was photographed a quarter or half turn round, every colour is right but the pieces don't fit together. Once all six sides are in, the app tries every way of turning each photo round (4,096 ways) and, if one fixes the cube, says e.g. "The blue side looks turned. Fix it?"
- **Light.** Daylight from a window is best. Tilt the cube a little if there's shine on the stickers. On phones that allow it (Android Chrome), a torch button in the corner of the camera's view switches the phone's light on.
- **Auto photo** only takes a side's first photo, and only when the grid sees black (or a dark gap) round each sticker, so it won't take a photo of the table. Retakes are always by button.

With a laptop's camera, which faces you, the picture is shown like a mirror so the cube moves the way your hand does, and the instructions say which side to turn towards the camera, e.g. "Turn your cube to the left, so the side on your left faces the camera".

Screen readers hear the colours each photo read, row by row, then what to do next. With **Letters on stickers** on, the dots show letters too.

The camera switches off when you tap **Done** or switch to another app.

To collect test data from real photos, add `?scan-debug` to the address: see [test/scan/test-photos/README.md](test/scan/test-photos/README.md).

### A 2x2, with no centres

A 3x3's centres never move and are all different colours, so the app learns from them what each colour looks like in your light. A 2x2 has none, so:

- **It learns its colours from your photos.** The first sides are named from typical camera colours. Once three sides are in, it works out what each colour looks like in your light from the squares given that colour, and names every square again. So in warm or dim light the first side's dots may be less sure than on a 3x3, and get better as you go.
- **Red/orange mix-ups are settled by the check before solving.** Red and orange are the colours most often confused. Once all six sides are in, if the colours couldn't be a real cube, the app tries switching up to 12 of its closest calls to their second-choice colour (4,096 ways) and keeps the switch that fits the photos best, if there's one clear winner. A side held turned is looked for first. Switched squares keep their dashed ring, so you can check them.
- **Sides are named by where they are** on the 3D cube, since there's no centre colour to name them by: "The left side looks turned. Fix it?" A side scanned twice is spotted by comparing all four squares, with the photo turned each of the 4 ways. About 1 in 60 scrambled 2x2s really has two sides that look alike, so it says "This looks like the left side, which you've already scanned. If it is, …". With a laptop's camera, "left" means left on the screen, which is the other way round from the cube in your hand; **Fix it** works either way.
- Screen readers name its squares top left, top right, bottom left and bottom right.

## Deployment

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): lint, format check, tests, build, end-to-end tests, then publish to GitHub Pages at `https://stevenlu0830.github.io/rubiks-cube-solver/`.

One-time setup: in the GitHub repo, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
