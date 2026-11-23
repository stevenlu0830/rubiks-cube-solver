import type { StageName } from '../solver/protocol.ts'

/** What each stage of a 4x4's solution is called on screen (see fourByFour.ts). */
export const STAGE_NAMES: Readonly<Record<StageName, string>> = {
  centres: 'Centres',
  edges: 'Pair the edges',
  parity: 'Parity fix',
  finish: 'Finish like a 3x3',
}
