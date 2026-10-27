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

| Command             | What it does                                                                       |
| ------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`       | Start the dev server on this computer                                              |
| `npm run dev:phone` | Same, but reachable from a phone on the same Wi-Fi (use the Network URL it prints) |
| `npm test`          | Run the tests once (`npm run test:watch` to re-run on save)                        |
| `npm run test:slow` | Run the long checks too, e.g. solving 1,000 random cubes (about 35 seconds)        |
| `npm run lint`      | Check the code for likely bugs with ESLint                                         |
| `npm run format`    | Auto-format all files with Prettier                                                |
| `npm run build`     | Type-check and build the production site into `dist/`                              |
| `npm run preview`   | Serve the built `dist/` locally                                                    |

## Deployment

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): lint, format check, tests, build, then publish to GitHub Pages at `https://stevenlu0830.github.io/rubiks-cube-solver/`.

One-time setup: in the GitHub repo, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
