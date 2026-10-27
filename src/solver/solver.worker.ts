import { initSolver, solveFacelets } from './kociemba.ts'
import type { SolveRequest, SolverMessage } from './protocol.ts'

/**
 * Runs the solver on a background thread, so the page stays smooth while the
 * solver sets up (a second or more) and while it solves.
 */

const send = (message: SolverMessage) => self.postMessage(message)

// Set up straight away, while the user is still painting. Requests that
// arrive meanwhile wait in line and are answered once this finishes.
initSolver()
send({ type: 'ready' })

self.addEventListener('message', (event: MessageEvent<SolveRequest>) => {
  const { id, facelets } = event.data
  try {
    send({ type: 'solution', id, moves: solveFacelets(facelets) })
  } catch (error) {
    send({ type: 'error', id, message: String(error) })
  }
})
