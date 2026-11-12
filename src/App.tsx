import { useEffect, useRef } from 'react'
// SolverPage first: it brings in most of the app's styles, and they must
// keep loading in the same order as before the picker page existed.
import { SolverPage } from './SolverPage.tsx'
import { CubePicker } from './picker/CubePicker.tsx'
import { pageTitle, useRoute } from './routes.ts'

/** Shows the page the address points to (see routes.ts). */
function App() {
  const route = useRoute()
  const shown = useRef(route)

  useEffect(() => {
    document.title = pageTitle(route)
    // On moving to another page (not on first opening the app), put the
    // focus on its title, so a screen reader says which page it is and
    // the keyboard carries on from the top of it.
    if (route !== shown.current) {
      shown.current = route
      document.querySelector<HTMLElement>('h1')?.focus()
    }
  }, [route])

  // A new SolverPage for each cube (`key`), so nothing carries over from one to the other.
  return route === 'picker' ? (
    <CubePicker />
  ) : (
    <SolverPage key={route} cube={route} />
  )
}

export default App
