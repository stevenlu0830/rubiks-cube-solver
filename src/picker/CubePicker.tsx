import { loadCube } from '../editor/storage.ts'
import { InfoButton } from '../info/InfoButton.tsx'
import {
  APP_NAME,
  CUBE_TYPES,
  hashFor,
  READY_CUBES,
  type CubeType,
} from '../routes.ts'
import { CubeIcon } from './CubeIcon.tsx'
import '../App.css'
import './picker.css'

const CUBES: Record<CubeType, { size: number; about: string }> = {
  '2x2': { size: 2, about: 'The pocket cube' },
  '3x3': { size: 3, about: "The classic Rubik's cube" },
}

/** True when a cube of this type has been part-painted and saved. */
function inProgress(cube: CubeType): boolean {
  return cube === '3x3' && (loadCube()?.some((cell) => cell !== null) ?? false)
}

/**
 * The first page: pick which cube to solve. Each cube that can be solved
 * is a link to its own page (see routes.ts); the others say they're coming.
 */
export function CubePicker() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-side" />
        <h1 tabIndex={-1}>{APP_NAME}</h1>
        <div className="header-side header-side-end">
          <InfoButton />
        </div>
      </header>
      <main className="picker">
        <h2>Which cube are you solving?</h2>
        <ul className="cube-cards">
          {CUBE_TYPES.map((cube) => {
            const { size, about } = CUBES[cube]
            const ready = READY_CUBES.includes(cube)
            const details = (
              <>
                <CubeIcon size={size} />
                <span className="cube-card-text">
                  <span className="cube-card-name">{cube}</span>
                  <span className="cube-card-about">{about}</span>
                  {!ready && (
                    <span className="cube-card-badge">Coming soon</span>
                  )}
                  {ready && inProgress(cube) && (
                    <span className="cube-card-badge">In progress</span>
                  )}
                </span>
              </>
            )
            return (
              <li key={cube}>
                {ready ? (
                  <a className="cube-card" href={hashFor(cube)}>
                    {details}
                    <span className="cube-card-arrow" aria-hidden="true">
                      ›
                    </span>
                  </a>
                ) : (
                  <div className="cube-card cube-card-soon">{details}</div>
                )}
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
