import type { Move } from '../cube/moves.ts'

/**
 * The messages the page and the solver worker send each other. A worker runs
 * on its own thread and shares no variables with the page, so messages are
 * the only way to talk to it.
 */

/** Page → worker: please solve this cube (see toFaceletString). */
export interface SolveRequest {
  id: number
  facelets: string
}

/** Worker → page. */
export type SolverMessage =
  /** Setup has finished; solves will now be quick. */
  | { type: 'ready' }
  | { type: 'solution'; id: number; moves: Move[] }
  | { type: 'error'; id: number; message: string }
