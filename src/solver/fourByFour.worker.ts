import { initFourByFourSolver, solveFourByFour } from './fourByFour.ts'
import type { SolveRequest, SolverMessage } from './protocol.ts'

/**
 * Runs the 4x4 solver on a background thread, like solver.worker.ts does
 * for the 3x3, so the page never waits on it. Its setup (about a second,
 * several on a slow phone) starts straight away, while the user is still
 * painting or scanning.
 */

const send = (message: SolverMessage) => self.postMessage(message)

// Requests that arrive meanwhile wait in line.
initFourByFourSolver()
send({ type: 'ready' })

self.addEventListener('message', (event: MessageEvent<SolveRequest>) => {
  const { id, facelets } = event.data
  try {
    const { moves, stages } = solveFourByFour(facelets)
    send({ type: 'solution', id, moves, stages })
  } catch (error) {
    send({ type: 'error', id, message: String(error) })
  }
})
