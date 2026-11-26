import type { Move } from '../cube/moves.ts'

/**
 * The messages the page and the solver worker send each other. A worker runs
 * on its own thread and shares no variables with the page, so messages are
 * the only way to talk to it.
 */

/**
 * The stages of a 4x4's or 5x5's solution, in order (see fourByFour.ts and
 * fiveByFive.ts): its centres, then its edge pieces paired up, then a fix
 * for the cases a 3x3 can't have (often not needed), then the rest, solved
 * like a 3x3.
 */
export type StageName = 'centres' | 'edges' | 'parity' | 'finish'

/** Where a stage of a solution starts: moves[start] is its first move. */
export interface Stage {
  name: StageName
  start: number
}

/**
 * The moves that solve a cube. A 4x4's or 5x5's solution also says where
 * each stage starts, leaving out any it didn't need; a 2x2 or 3x3 has no
 * stages.
 */
export interface Solution {
  moves: Move[]
  stages: Stage[]
}

/** Page → worker: please solve this cube (see toFaceletString). */
export interface SolveRequest {
  id: number
  facelets: string
}

/** Worker → page. */
export type SolverMessage =
  /** Setup has finished; solves will now be quick. */
  | { type: 'ready' }
  | { type: 'solution'; id: number; moves: Move[]; stages?: Stage[] }
  | { type: 'error'; id: number; message: string }
