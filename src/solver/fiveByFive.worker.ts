import { initFiveByFiveSolver, solveFiveByFive } from './fiveByFive.ts'
import type { SolveRequest, SolverMessage } from './protocol.ts'

/**
 * Runs the 5x5 solver on a background thread, like fourByFour.worker.ts
 * does for the 4x4, so the page never waits on it. Its setup (about a
 * second, several on a slow phone) starts straight away.
 */

const send = (message: SolverMessage) => self.postMessage(message)

// Requests that arrive meanwhile wait in line.
initFiveByFiveSolver()
send({ type: 'ready' })

self.addEventListener('message', (event: MessageEvent<SolveRequest>) => {
  const { id, facelets } = event.data
  try {
    const { moves, stages } = solveFiveByFive(facelets)
    send({ type: 'solution', id, moves, stages })
  } catch (error) {
    send({ type: 'error', id, message: String(error) })
  }
})
