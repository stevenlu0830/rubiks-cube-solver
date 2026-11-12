import { describe, expect, it } from 'vitest'
import { seededRandom } from '../helpers/seededRandom.ts'
import {
  applyMove,
  applyMoves,
  formatMoves,
  invertMove,
  invertMoves,
  MOVES,
  parseMoves,
  randomScramble,
  type Move,
} from '../../src/cube/moves.ts'
import { PUZZLE_2X2 } from '../../src/cube/puzzle.ts'
import {
  CENTER,
  cellIndex,
  colorCounts,
  COLORS,
  FACES,
  isSolved,
  solvedState,
  STANDARD_SCHEME,
  type Color,
  type Face,
} from '../../src/cube/state.ts'

/**
 * Every cell holds its own index, so any cell that ends up in the wrong place
 * is caught. (On a coloured cube, 9 cells share each colour, so mistakes can
 * hide.)
 */
const NUMBERED = Array.from({ length: 54 }, (_, i) => i)

const cells = (face: Face, ns: number[]) => ns.map((n) => cellIndex(face, n))

describe('every move', () => {
  it.each(MOVES)('%s done 4 times returns the starting state', (move) => {
    expect(applyMoves(NUMBERED, [move, move, move, move])).toEqual(NUMBERED)
  })

  it.each(MOVES)(
    '%s followed by its inverse returns the starting state',
    (move) => {
      expect(applyMoves(NUMBERED, [move, invertMove(move)])).toEqual(NUMBERED)
    },
  )

  it.each(MOVES)('%s actually changes the cube', (move) => {
    expect(applyMove(NUMBERED, move)).not.toEqual(NUMBERED)
  })
})

describe('move relationships', () => {
  it.each(['U', 'D', 'L', 'R', 'F', 'B', 'x', 'y', 'z'] as const)(
    "%s2 is two quarter turns and %s' is three",
    (base) => {
      expect(applyMove(NUMBERED, `${base}2`)).toEqual(
        applyMoves(NUMBERED, [base, base]),
      )
      expect(applyMove(NUMBERED, `${base}'`)).toEqual(
        applyMoves(NUMBERED, [base, base, base]),
      )
    },
  )
})

describe('face turns', () => {
  it.each(FACES)(
    '%s moves exactly 20 stickers and keeps every centre in place',
    (face) => {
      const after = applyMove(NUMBERED, face)
      const moved = after.filter((cell, i) => cell !== i)
      expect(moved).toHaveLength(20)
      for (const f of FACES) {
        const center = cellIndex(f, CENTER)
        expect(after[center]).toBe(center)
      }
    },
  )

  // On the standard scheme: U white, D yellow, F green, B blue, R red, L orange.
  const cases: [Move, Face, number[], Color][] = [
    ['U', 'F', [0, 1, 2], 'red'], // right side's top row comes to the front
    ['D', 'F', [6, 7, 8], 'orange'], // left side's bottom row comes to the front
    ['R', 'U', [2, 5, 8], 'green'], // front's right column goes up
    ['L', 'U', [0, 3, 6], 'blue'], // back's left column comes over the top
    ['F', 'U', [6, 7, 8], 'orange'], // left side's column goes up to the top
    ['B', 'U', [0, 1, 2], 'red'], // right side's column goes up to the top
  ]
  it.each(cases)(
    '%s turns clockwise: %s cells %j become %s',
    (move, face, ns, color) => {
      const after = applyMove(solvedState(), move)
      for (const cell of cells(face, ns)) {
        expect(after[cell]).toBe(color)
      }
    },
  )
})

describe('whole-cube rotations', () => {
  const cases: [Move, Face, Color][] = [
    ['x', 'U', 'green'], // like R: the front comes up to the top
    ['y', 'F', 'red'], // like U: the right side comes to the front
    ['z', 'U', 'orange'], // like F: the left side comes up to the top
  ]
  it.each(cases)(
    '%s turns the whole cube: the %s face becomes %s',
    (move, face, color) => {
      const after = applyMove(solvedState(), move)
      expect(after.slice(cellIndex(face, 0), cellIndex(face, 9))).toEqual(
        Array(9).fill(color),
      )
      expect(isSolved(after)).toBe(true)
    },
  )
})

describe('algorithms', () => {
  it("(R U R' U') done 6 times returns the starting state", () => {
    const sexyMove = parseMoves("R U R' U'")
    expect(applyMoves(NUMBERED, sexyMove)).not.toEqual(NUMBERED)
    expect(
      applyMoves(NUMBERED, Array.from({ length: 6 }, () => sexyMove).flat()),
    ).toEqual(NUMBERED)
  })

  it('any random sequence followed by its inverse returns the starting state', () => {
    const random = seededRandom(1)
    for (let run = 0; run < 200; run++) {
      const moves = Array.from(
        { length: 30 },
        () => MOVES[Math.floor(random() * MOVES.length)],
      )
      const scrambled = applyMoves(NUMBERED, moves)
      expect(applyMoves(scrambled, invertMoves(moves))).toEqual(NUMBERED)
    }
  })

  it('a random scramble followed by its inverse gives a solved cube', () => {
    const random = seededRandom(2)
    for (let run = 0; run < 200; run++) {
      const scramble = randomScramble(25, random)
      const scrambled = applyMoves(solvedState(), scramble)
      expect(isSolved(scrambled)).toBe(false)
      expect(isSolved(applyMoves(scrambled, invertMoves(scramble)))).toBe(true)
    }
  })

  it('(R U) done 105 times returns the starting state', () => {
    const moves = Array.from({ length: 105 }, () => parseMoves('R U')).flat()
    expect(applyMoves(NUMBERED, moves)).toEqual(NUMBERED)
  })
})

describe('randomScramble', () => {
  it('makes face turns only, never the same face twice in a row', () => {
    const scramble = randomScramble(100, seededRandom(3))
    expect(scramble).toHaveLength(100)
    scramble.forEach((move, i) => {
      expect(FACES).toContain(move[0])
      if (i > 0) expect(move[0]).not.toBe(scramble[i - 1][0])
    })
  })

  it('gives the same scramble for the same seed', () => {
    expect(randomScramble(25, seededRandom(4))).toEqual(
      randomScramble(25, seededRandom(4)),
    )
  })
})

describe('notation', () => {
  it('parses and formats moves', () => {
    const moves = parseMoves("  R U2  F' x y' z2 ")
    expect(moves).toEqual(['R', 'U2', "F'", 'x', "y'", 'z2'])
    expect(formatMoves(moves)).toBe("R U2 F' x y' z2")
  })

  it('parses an empty string as no moves', () => {
    expect(parseMoves('')).toEqual([])
  })

  it('rejects unknown moves', () => {
    expect(() => parseMoves('R Q')).toThrow('Unknown move "Q"')
    expect(() => parseMoves('r')).toThrow()
  })

  it('inverts a sequence by reversing it and inverting each move', () => {
    expect(formatMoves(invertMoves(parseMoves("R U2 F'")))).toBe("F U2 R'")
  })
})

describe('on a 2x2', () => {
  const NUMBERED_2X2 = Array.from({ length: 24 }, (_, i) => i)
  const SOLVED_2X2 = solvedState(STANDARD_SCHEME, PUZZLE_2X2)

  it.each(MOVES)('%s done 4 times returns the starting state', (move) => {
    expect(applyMoves(NUMBERED_2X2, [move, move, move, move])).toEqual(
      NUMBERED_2X2,
    )
  })

  it.each(MOVES)(
    '%s followed by its inverse returns the starting state',
    (move) => {
      expect(applyMoves(NUMBERED_2X2, [move, invertMove(move)])).toEqual(
        NUMBERED_2X2,
      )
    },
  )

  it.each(MOVES.filter((move) => move.length === 1))(
    '%s done twice is the same as a half turn',
    (move) => {
      expect(applyMoves(NUMBERED_2X2, [move, move])).toEqual(
        applyMove(NUMBERED_2X2, `${move}2` as Move),
      )
    },
  )

  it.each(FACES)(
    '%s moves exactly 12 cells: its own 4, and 2 on each face round it',
    (face) => {
      const after = applyMove(NUMBERED_2X2, face)
      const moved = NUMBERED_2X2.filter((cell) => after[cell] !== cell)
      expect(moved).toHaveLength(12)
      const own = [0, 1, 2, 3].map((n) => cellIndex(face, n, PUZZLE_2X2))
      for (const cell of own) expect(moved).toContain(cell)
    },
  )

  it('turns the whole cube like turning two opposite faces, since a 2x2 has no middle layer', () => {
    expect(applyMove(NUMBERED_2X2, 'y')).toEqual(
      applyMoves(NUMBERED_2X2, parseMoves("U D'")),
    )
    expect(applyMove(NUMBERED_2X2, 'x')).toEqual(
      applyMoves(NUMBERED_2X2, parseMoves("R L'")),
    )
    expect(applyMove(NUMBERED_2X2, 'z')).toEqual(
      applyMoves(NUMBERED_2X2, parseMoves("F B'")),
    )
  })

  it("moves the corners exactly as on a 3x3 (a 2x2 is a 3x3's corners)", () => {
    // A 2x2 cell at (row, column) of a face matches the 3x3 corner cell at
    // (2 × row, 2 × column) of that face.
    const onThreeByThree = (cell: number) => {
      const face = Math.floor(cell / 4)
      const [row, column] = [Math.floor((cell % 4) / 2), cell % 2]
      return face * 9 + row * 2 * 3 + column * 2
    }
    const moves = randomScramble(40, seededRandom(22))
    const twoByTwo = applyMoves(NUMBERED_2X2, moves)
    const threeByThree = applyMoves(
      Array.from({ length: 54 }, (_, i) => i),
      moves,
    )
    NUMBERED_2X2.forEach((cell) => {
      expect(threeByThree[onThreeByThree(cell)]).toBe(
        onThreeByThree(twoByTwo[cell]),
      )
    })
  })

  it("R U R' U' six times returns to the start", () => {
    const sexyMove = parseMoves("R U R' U'")
    const sixTimes = Array.from({ length: 6 }, () => sexyMove).flat()
    expect(applyMoves(NUMBERED_2X2, sixTimes)).toEqual(NUMBERED_2X2)
    expect(applyMoves(NUMBERED_2X2, sexyMove)).not.toEqual(NUMBERED_2X2)
  })

  it('scrambles a solved cube, keeping 4 of each colour, and the inverse solves it', () => {
    const random = seededRandom(23)
    for (let run = 0; run < 20; run++) {
      const scramble = randomScramble(15, random)
      const scrambled = applyMoves(SOLVED_2X2, scramble)
      for (const color of COLORS) {
        expect(colorCounts(scrambled)[color]).toBe(4)
      }
      const solved = applyMoves(scrambled, invertMoves(scramble))
      expect(isSolved(solved)).toBe(true)
      expect(solved).toEqual(SOLVED_2X2)
    }
  })
})
