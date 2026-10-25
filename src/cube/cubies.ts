import { faceNormal, stickerIndexAt, type Vec3 } from './geometry.ts'
import {
  CENTER,
  cellIndex,
  FACES,
  type Color,
  type ColorScheme,
  solvedState,
  type CubeState,
  type Face,
} from './state.ts'

/**
 * The cube as pieces instead of stickers: which corner and edge piece sits in
 * each slot, and how it is turned there. The Phase 5 validator needs this
 * view, because the rules for a solvable cube (e.g. "corner twists must add
 * up to a multiple of 3") are about pieces, not stickers.
 *
 * Numbering and orientation follow Kociemba's cubie model. A piece's name
 * lists its faces starting with U or D (for corners) and going clockwise, so
 * 'URF' is the Up-Right-Front corner. The same names label both slots
 * (fixed places on the cube) and pieces (the plastic bits that move between
 * them): on a solved cube, piece URF sits in slot URF.
 */
export const CORNERS = [
  'URF',
  'UFL',
  'ULB',
  'UBR',
  'DFR',
  'DLF',
  'DBL',
  'DRB',
] as const
export const EDGES = [
  'UR',
  'UF',
  'UL',
  'UB',
  'DR',
  'DF',
  'DL',
  'DB',
  'FR',
  'FL',
  'BL',
  'BR',
] as const

export interface CubieCube {
  /** cp[slot] = which corner piece is in that slot (index into CORNERS), or -1 if its colours match no real corner. */
  cp: number[]
  /** co[slot] = how the corner is twisted: 0 when its U/D-coloured sticker faces up or down, otherwise 1 or 2. */
  co: number[]
  /** ep[slot] = which edge piece is in that slot (index into EDGES), or -1 if its colours match no real edge. */
  ep: number[]
  /** eo[slot] = 0 if the edge sits the right way round, 1 if it is flipped. */
  eo: number[]
}

/** The cell indexes of each slot's stickers, in the order its name lists faces. */
function slotCells(name: string): number[] {
  const faces = [...name] as Face[]
  const position = faces
    .map(faceNormal)
    .reduce<Vec3>(
      (sum, n) => [sum[0] + n[0], sum[1] + n[1], sum[2] + n[2]],
      [0, 0, 0],
    )
  return faces.map((face) => stickerIndexAt(position, faceNormal(face)))
}

export const CORNER_CELLS: readonly number[][] = CORNERS.map(slotCells)
export const EDGE_CELLS: readonly number[][] = EDGES.map(slotCells)

export function solvedCubies(): CubieCube {
  return {
    cp: CORNERS.map((_, i) => i),
    co: CORNERS.map(() => 0),
    ep: EDGES.map((_, i) => i),
    eo: EDGES.map(() => 0),
  }
}

/**
 * Reads which piece is in each slot from the cell colours. Each face is
 * identified by its centre colour, so this works whichever way the cube is
 * held.
 *
 * Returns null if any cell is unpainted or the six centres aren't six
 * different colours, because then the pieces can't be identified at all.
 */
export function toCubies(state: CubeState): CubieCube | null {
  const faceOfColor = new Map<Color, Face>()
  for (const face of FACES) {
    const center = state[cellIndex(face, CENTER)]
    if (center === null || faceOfColor.has(center)) return null
    faceOfColor.set(center, face)
  }
  if (state.some((cell) => cell === null)) return null
  const faceAt = (cell: number) => faceOfColor.get(state[cell]!)!

  const cp: number[] = []
  const co: number[] = []
  for (const cells of CORNER_CELLS) {
    const faces = cells.map(faceAt)
    // The twist is which of the slot's three stickers shows the U or D colour.
    const twist = faces.findIndex((face) => face === 'U' || face === 'D')
    const piece =
      twist === -1
        ? -1
        : CORNERS.findIndex((corner) =>
            [...corner].every((face, k) => face === faces[(twist + k) % 3]),
          )
    cp.push(piece)
    co.push(piece === -1 ? 0 : twist)
  }

  const ep: number[] = []
  const eo: number[] = []
  for (const [a, b] of EDGE_CELLS) {
    const straight = EDGES.findIndex((edge) => edge === faceAt(a) + faceAt(b))
    const flipped = EDGES.findIndex((edge) => edge === faceAt(b) + faceAt(a))
    ep.push(straight !== -1 ? straight : flipped)
    eo.push(straight === -1 && flipped !== -1 ? 1 : 0)
  }

  return { cp, co, ep, eo }
}

/** The opposite of toCubies: paints the cells for these pieces. */
export function fromCubies(
  { cp, co, ep, eo }: CubieCube,
  scheme: ColorScheme,
): CubeState {
  if (cp.includes(-1) || ep.includes(-1)) {
    throw new Error('Cannot paint a cube with unrecognised pieces')
  }
  const state = [...solvedState(scheme)]
  CORNER_CELLS.forEach((cells, slot) => {
    const corner = CORNERS[cp[slot]]
    for (let k = 0; k < 3; k++) {
      state[cells[(k + co[slot]) % 3]] = scheme[corner[k] as Face]
    }
  })
  EDGE_CELLS.forEach((cells, slot) => {
    const edge = EDGES[ep[slot]]
    for (let k = 0; k < 2; k++) {
      state[cells[(k + eo[slot]) % 2]] = scheme[edge[k] as Face]
    }
  })
  return state
}
