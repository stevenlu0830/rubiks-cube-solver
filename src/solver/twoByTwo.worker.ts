import type { SolveRequest, SolverMessage } from './protocol.ts'
import { initTwoByTwoSolver, solveTwoByTwo } from './twoByTwo.ts'

/**
 * Runs the 2x2 solver on a background thread, like solver.worker.ts does
 * for the 3x3, so the page never waits on it. Its own worker, so the 2x2
 * page never loads the 3x3's much bigger solver (cubejs).
 */

const send = (message: SolverMessage) => self.postMessage(message)

// Setting up takes a few milliseconds; requests meanwhile wait in line.
initTwoByTwoSolver()
send({ type: 'ready' })

self.addEventListener('message', (event: MessageEvent<SolveRequest>) => {
  const { id, facelets } = event.data
  try {
    send({ type: 'solution', id, moves: solveTwoByTwo(facelets) })
  } catch (error) {
    send({ type: 'error', id, message: String(error) })
  }
})
