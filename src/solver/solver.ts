import type { Move } from '../cube/moves.ts'
import type { SolveRequest, SolverMessage } from './protocol.ts'

/**
 * The page's side of the solver: starts the worker, sends it cubes, and
 * turns its answers back into promises. Also copes with things going wrong:
 * a solve that takes too long, or a worker that crashes or never loads.
 */

/** Longest to wait for an answer, including any setup still in progress. */
export const SOLVE_TIMEOUT_MS = 30_000

export type SolverErrorCode =
  /** No answer in time. */
  | 'timeout'
  /** The worker crashed or couldn't load (e.g. offline when the page needed it). */
  | 'unavailable'
  /** The solver ran but couldn't solve this cube. */
  | 'failed'

export class SolverError extends Error {
  readonly code: SolverErrorCode
  constructor(code: SolverErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

/** What to tell the user when solving fails. */
export function solverErrorMessage(error: unknown): string {
  const code = error instanceof SolverError ? error.code : 'failed'
  switch (code) {
    case 'timeout':
      return 'The solver took too long. Please try again.'
    case 'unavailable':
      return "The solver couldn't start. Check your internet connection, reload the page and try again."
    case 'failed':
      return "The solver couldn't solve this cube. Please check your painting matches your cube."
  }
}

/** The parts of a browser Worker the solver uses, so tests can pass a fake one. */
export interface WorkerLike {
  postMessage(request: SolveRequest): void
  terminate(): void
  onmessage: ((event: MessageEvent<SolverMessage>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

export interface Solver {
  /** True once the worker has finished setting up, so a solve will be quick. */
  isReady(): boolean
  /** Face turns that solve the cube (see toFaceletString). Rejects with a SolverError. */
  solve(facelets: string): Promise<Move[]>
}

const startWorker = (): WorkerLike =>
  new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })

export function createSolver(
  makeWorker: () => WorkerLike = startWorker,
  timeoutMs = SOLVE_TIMEOUT_MS,
): Solver {
  let worker: WorkerLike | null = null
  let ready = false
  let nextId = 1
  const waiting = new Map<
    number,
    {
      resolve: (moves: Move[]) => void
      reject: (error: SolverError) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()

  function start() {
    ready = false
    const current = makeWorker()
    worker = current
    current.onmessage = ({ data: message }) => {
      if (message.type === 'ready') {
        ready = true
        return
      }
      const request = waiting.get(message.id)
      if (!request) return // e.g. it already timed out
      waiting.delete(message.id)
      clearTimeout(request.timer)
      if (message.type === 'solution') request.resolve(message.moves)
      else request.reject(new SolverError('failed', message.message))
    }
    current.onerror = () =>
      stop(new SolverError('unavailable', 'The solver stopped working.'))
  }

  /** Throws the worker away and fails every request still waiting on it. */
  function stop(error: SolverError) {
    worker?.terminate()
    worker = null
    ready = false
    for (const { reject, timer } of waiting.values()) {
      clearTimeout(timer)
      reject(error)
    }
    waiting.clear()
  }

  start()

  return {
    isReady: () => ready,
    solve(facelets) {
      // A worker that crashed, failed to load or got stuck is replaced on the next try.
      if (!worker) start()
      return new Promise((resolve, reject) => {
        const id = nextId++
        const timer = setTimeout(
          () => stop(new SolverError('timeout', 'The solver took too long.')),
          timeoutMs,
        )
        waiting.set(id, { resolve, reject, timer })
        worker!.postMessage({ id, facelets })
      })
    },
  }
}

let shared: Solver | undefined

/**
 * The app's one solver, started on first use. The app asks for it as soon as
 * it loads, so the setup is usually done before the user finishes painting.
 */
export function getSolver(): Solver {
  shared ??= createSolver()
  return shared
}
