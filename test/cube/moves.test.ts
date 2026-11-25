import { describe, expect, it } from 'vitest'
import { seededRandom } from '../helpers/seededRandom.ts'
import {
  applyMove,
  applyMoves,
  formatMoves,
  invertMove,
  invertMoves,
  LAYER_MOVES,
  MOVES,
  movesOf,
  parseMoves,
  randomScramble,
  turnedLayers,
  type Move,
} from '../../src/cube/moves.ts'
import {
  PUZZLE_2X2,
  PUZZLE_3X3,
  PUZZLE_4X4,
  PUZZLE_5X5,
} from '../../src/cube/puzzle.ts'
import {
  centerCell,
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
        const center = centerCell(f)
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

  it("parses a 4x4's wide and inner-layer moves", () => {
    const moves = parseMoves("Rw r' Uw2 b")
    expect(moves).toEqual(['Rw', "r'", 'Uw2', 'b'])
    expect(formatMoves(moves)).toBe("Rw r' Uw2 b")
  })

  it('rejects unknown moves', () => {
    expect(() => parseMoves('R Q')).toThrow('Unknown move "Q"')
    for (const token of ['M', 'rw', 'Rw3', 'X', 'xw']) {
      expect(() => parseMoves(token), token).toThrow()
    }
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

describe('turnedLayers', () => {
  it('says which face a move is named after and which layers it turns, counted in from that face', () => {
    expect(turnedLayers('R')).toEqual({ face: 'R', layers: [0] })
    expect(turnedLayers("Rw'")).toEqual({ face: 'R', layers: [0, 1] })
    expect(turnedLayers('r2')).toEqual({ face: 'R', layers: [1] })
    expect(turnedLayers('l')).toEqual({ face: 'L', layers: [1] })
    expect(turnedLayers('Dw2')).toEqual({ face: 'D', layers: [0, 1] })
  })

  it('turns every layer for a whole-cube turn, however big the cube', () => {
    expect(turnedLayers("y'")).toEqual({ face: 'U', layers: [0, 1, 2] })
    expect(turnedLayers('x', PUZZLE_4X4)).toEqual({
      face: 'R',
      layers: [0, 1, 2, 3],
    })
    expect(turnedLayers('z2', PUZZLE_2X2)).toEqual({
      face: 'F',
      layers: [0, 1],
    })
    expect(turnedLayers("x'", PUZZLE_5X5)).toEqual({
      face: 'R',
      layers: [0, 1, 2, 3, 4],
    })
  })

  it('turns the same layers on a 5x5 as on a 4x4: Rw the outer two, r only the second', () => {
    expect(turnedLayers('Rw', PUZZLE_5X5)).toEqual({
      face: 'R',
      layers: [0, 1],
    })
    expect(turnedLayers('r', PUZZLE_5X5)).toEqual({ face: 'R', layers: [1] })
  })
})

describe('movesOf', () => {
  it('gives a 2x2 and a 3x3 only the face and whole-cube turns', () => {
    expect(movesOf(PUZZLE_2X2)).toEqual(MOVES)
    expect(movesOf(PUZZLE_3X3)).toEqual(MOVES)
    expect(MOVES).toHaveLength(27)
  })

  it('gives a 4x4 and a 5x5 their 18 wide and 18 inner-layer turns as well', () => {
    expect(LAYER_MOVES).toHaveLength(36)
    expect(movesOf(PUZZLE_4X4)).toEqual([...MOVES, ...LAYER_MOVES])
    expect(movesOf(PUZZLE_5X5)).toEqual([...MOVES, ...LAYER_MOVES])
    expect(LAYER_MOVES).toEqual(
      expect.arrayContaining(['Rw', "Rw'", 'Rw2', 'r', "r'", 'r2']),
    )
  })

  it("won't do a wide or inner-layer turn on a 2x2 or 3x3, which have no inner layer to themselves", () => {
    expect(() => applyMove(NUMBERED, 'Rw')).toThrow("A 3x3 can't do Rw")
    expect(() =>
      applyMove(
        Array.from({ length: 24 }, (_, i) => i),
        'r',
      ),
    ).toThrow("A 2x2 can't do r")
  })
})

describe('on a 4x4', () => {
  const NUMBERED_4X4 = Array.from({ length: 96 }, (_, i) => i)
  const SOLVED_4X4 = solvedState(STANDARD_SCHEME, PUZZLE_4X4)
  const MOVES_4X4 = movesOf(PUZZLE_4X4)
  const cells4 = (face: Face, ns: number[]) =>
    ns.map((n) => cellIndex(face, n, PUZZLE_4X4))
  /** The cells of a face's row or column, 0 to 3 from the top or left. */
  const row = (face: Face, r: number) =>
    cells4(
      face,
      [0, 1, 2, 3].map((c) => r * 4 + c),
    )
  const column = (face: Face, c: number) =>
    cells4(
      face,
      [0, 1, 2, 3].map((r) => r * 4 + c),
    )
  const facesOf = (base: string) => base.replace(/['2]$/, '')

  it.each(MOVES_4X4)('%s done 4 times returns the starting state', (move) => {
    expect(applyMoves(NUMBERED_4X4, [move, move, move, move])).toEqual(
      NUMBERED_4X4,
    )
  })

  it.each(MOVES_4X4)(
    '%s followed by its inverse returns the starting state',
    (move) => {
      expect(applyMoves(NUMBERED_4X4, [move, invertMove(move)])).toEqual(
        NUMBERED_4X4,
      )
    },
  )

  it.each(MOVES_4X4)('%s actually changes the cube', (move) => {
    expect(applyMove(NUMBERED_4X4, move)).not.toEqual(NUMBERED_4X4)
  })

  it.each(MOVES_4X4.filter((move) => move === facesOf(move)))(
    "%s2 is two quarter turns and %s' is three",
    (base) => {
      expect(applyMove(NUMBERED_4X4, `${base}2` as Move)).toEqual(
        applyMoves(NUMBERED_4X4, [base, base]),
      )
      expect(applyMove(NUMBERED_4X4, `${base}'` as Move)).toEqual(
        applyMoves(NUMBERED_4X4, [base, base, base]),
      )
    },
  )

  it.each(FACES)(
    '%sw (wide) is the same as turning that face and the inner layer behind it',
    (face) => {
      const inner = face.toLowerCase()
      for (const turn of ['', "'", '2']) {
        expect(applyMove(NUMBERED_4X4, `${face}w${turn}` as Move)).toEqual(
          applyMoves(NUMBERED_4X4, [
            `${face}${turn}` as Move,
            `${inner}${turn}` as Move,
          ]),
        )
      }
    },
  )

  it.each(FACES)(
    '%s moves 32 cells (its own 16, and 4 on each face round it); its inner layer 16; both together 48',
    (face) => {
      const moved = (move: Move) =>
        NUMBERED_4X4.filter(
          (cell) => applyMove(NUMBERED_4X4, move)[cell] !== cell,
        )
      expect(moved(face)).toHaveLength(32)
      expect(moved(face.toLowerCase() as Move)).toHaveLength(16)
      expect(moved(`${face}w`)).toHaveLength(48)
    },
  )

  it.each(FACES)(
    "%s's inner layer leaves that face, the face opposite and every corner alone",
    (face) => {
      const after = applyMove(NUMBERED_4X4, face.toLowerCase() as Move)
      const opposite = FACES[(FACES.indexOf(face) + 3) % 6]
      for (const cell of [
        ...cells4(face, [...Array(16).keys()]),
        ...cells4(opposite, [...Array(16).keys()]),
        ...FACES.flatMap((f) => cells4(f, [0, 3, 12, 15])),
      ]) {
        expect(after[cell]).toBe(cell)
      }
    },
  )

  it("turns the whole cube like turning every layer: x is R r l' L', or Rw Lw'", () => {
    expect(applyMove(NUMBERED_4X4, 'x')).toEqual(
      applyMoves(NUMBERED_4X4, parseMoves("R r l' L'")),
    )
    expect(applyMove(NUMBERED_4X4, 'x')).toEqual(
      applyMoves(NUMBERED_4X4, parseMoves("Rw Lw'")),
    )
    expect(applyMove(NUMBERED_4X4, 'y')).toEqual(
      applyMoves(NUMBERED_4X4, parseMoves("Uw Dw'")),
    )
    expect(applyMove(NUMBERED_4X4, 'z')).toEqual(
      applyMoves(NUMBERED_4X4, parseMoves("F f b' B'")),
    )
  })

  // On the standard scheme: U white, D yellow, F green, B blue, R red, L orange.
  it('turns the inner layer the same way as its face: r lifts the front up over the top', () => {
    const after = applyMove(SOLVED_4X4, 'r')
    for (const cell of column('U', 2)) expect(after[cell]).toBe('green')
    for (const c of [0, 1, 3]) {
      for (const cell of column('U', c)) expect(after[cell]).toBe('white')
    }
  })

  it("turns two layers with a wide turn: Rw lifts the front's right half up over the top", () => {
    const after = applyMove(SOLVED_4X4, 'Rw')
    for (const c of [2, 3]) {
      for (const cell of column('U', c)) expect(after[cell]).toBe('green')
    }
    for (const c of [0, 1]) {
      for (const cell of column('U', c)) expect(after[cell]).toBe('white')
    }
  })

  it("u brings the right side's second row to the front; f lifts the left side's second column onto the top", () => {
    const u = applyMove(SOLVED_4X4, 'u')
    for (const cell of row('F', 1)) expect(u[cell]).toBe('red')
    for (const r of [0, 2, 3]) {
      for (const cell of row('F', r)) expect(u[cell]).toBe('green')
    }
    const f = applyMove(SOLVED_4X4, 'f')
    for (const cell of row('U', 2)) expect(f[cell]).toBe('orange')
    for (const cell of row('U', 3)) expect(f[cell]).toBe('white')
  })

  it('moves the corners exactly as a 2x2 does (a 4x4 has the same 8 corners)', () => {
    // A 2x2 cell at (row, column) of a face matches the 4x4 corner cell at
    // (3 × row, 3 × column) of that face.
    const onFourByFour = (cell: number) => {
      const face = Math.floor(cell / 4)
      const [r, c] = [Math.floor((cell % 4) / 2), cell % 2]
      return face * 16 + r * 3 * 4 + c * 3
    }
    const NUMBERED_2X2 = Array.from({ length: 24 }, (_, i) => i)
    const moves = randomScramble(40, seededRandom(31))
    const twoByTwo = applyMoves(NUMBERED_2X2, moves)
    const fourByFour = applyMoves(NUMBERED_4X4, moves)
    NUMBERED_2X2.forEach((cell) => {
      expect(fourByFour[onFourByFour(cell)]).toBe(onFourByFour(twoByTwo[cell]))
    })
  })

  it('scrambles with every kind of turn, keeping 16 of each colour, and the inverse solves it', () => {
    const random = seededRandom(32)
    for (let run = 0; run < 50; run++) {
      const scramble = Array.from(
        { length: 40 },
        () => MOVES_4X4[Math.floor(random() * MOVES_4X4.length)],
      )
      const scrambled = applyMoves(SOLVED_4X4, scramble)
      for (const color of COLORS) {
        expect(colorCounts(scrambled)[color]).toBe(16)
      }
      expect(applyMoves(scrambled, invertMoves(scramble))).toEqual(SOLVED_4X4)
      expect(
        applyMoves(applyMoves(NUMBERED_4X4, scramble), invertMoves(scramble)),
      ).toEqual(NUMBERED_4X4)
    }
  })
})

describe('on a 5x5', () => {
  const NUMBERED_5X5 = Array.from({ length: 150 }, (_, i) => i)
  const SOLVED_5X5 = solvedState(STANDARD_SCHEME, PUZZLE_5X5)
  const MOVES_5X5 = movesOf(PUZZLE_5X5)
  const ROTATIONS = MOVES_5X5.filter((move) => /^[xyz]/.test(move))
  const TURNS = MOVES_5X5.filter((move) => !/^[xyz]/.test(move))
  const cells5 = (face: Face, ns: number[]) =>
    ns.map((n) => cellIndex(face, n, PUZZLE_5X5))
  const ALL = [...Array(25).keys()]
  /** The cells of a face's row or column, 0 to 4 from the top or left. */
  const row = (face: Face, r: number) =>
    cells5(
      face,
      [0, 1, 2, 3, 4].map((c) => r * 5 + c),
    )
  const column = (face: Face, c: number) =>
    cells5(
      face,
      [0, 1, 2, 3, 4].map((r) => r * 5 + c),
    )
  const facesOf = (base: string) => base.replace(/['2]$/, '')
  const moved = (move: Move) =>
    NUMBERED_5X5.filter((cell) => applyMove(NUMBERED_5X5, move)[cell] !== cell)

  it.each(MOVES_5X5)('%s done 4 times returns the starting state', (move) => {
    expect(applyMoves(NUMBERED_5X5, [move, move, move, move])).toEqual(
      NUMBERED_5X5,
    )
  })

  it.each(MOVES_5X5)(
    '%s followed by its inverse returns the starting state',
    (move) => {
      expect(applyMoves(NUMBERED_5X5, [move, invertMove(move)])).toEqual(
        NUMBERED_5X5,
      )
    },
  )

  it.each(MOVES_5X5)('%s actually changes the cube', (move) => {
    expect(applyMove(NUMBERED_5X5, move)).not.toEqual(NUMBERED_5X5)
  })

  it.each(MOVES_5X5.filter((move) => move === facesOf(move)))(
    "%s2 is two quarter turns and %s' is three",
    (base) => {
      expect(applyMove(NUMBERED_5X5, `${base}2` as Move)).toEqual(
        applyMoves(NUMBERED_5X5, [base, base]),
      )
      expect(applyMove(NUMBERED_5X5, `${base}'` as Move)).toEqual(
        applyMoves(NUMBERED_5X5, [base, base, base]),
      )
    },
  )

  it.each(FACES)(
    '%sw (wide) is the same as turning that face and the inner layer behind it',
    (face) => {
      const inner = face.toLowerCase()
      for (const turn of ['', "'", '2']) {
        expect(applyMove(NUMBERED_5X5, `${face}w${turn}` as Move)).toEqual(
          applyMoves(NUMBERED_5X5, [
            `${face}${turn}` as Move,
            `${inner}${turn}` as Move,
          ]),
        )
      }
    },
  )

  it.each(FACES)(
    '%s moves 44 cells (its own 24 round the centre, and 5 on each face round it); its inner layer 20; both together 64',
    (face) => {
      expect(moved(face)).toHaveLength(44)
      expect(moved(face.toLowerCase() as Move)).toHaveLength(20)
      expect(moved(`${face}w`)).toHaveLength(64)
    },
  )

  it("turns any two layers of the same axis without getting in each other's way", () => {
    // Each axis's layers, from one side to the other (the middle has no move).
    const axes = [
      ['R', 'r', 'l', 'L', 'Rw', 'Lw'],
      ['U', 'u', 'd', 'D', 'Uw', 'Dw'],
      ['F', 'f', 'b', 'B', 'Fw', 'Bw'],
    ] as const
    for (const layers of axes) {
      for (const a of layers) {
        for (const b of layers) {
          expect(applyMoves(NUMBERED_5X5, [a, b]), `${a} ${b}`).toEqual(
            applyMoves(NUMBERED_5X5, [b, a]),
          )
        }
      }
    }
  })

  it.each(TURNS)(
    '%s never moves a centre square: only turning the whole cube does',
    (move) => {
      const after = applyMove(NUMBERED_5X5, move)
      for (const face of FACES) {
        const center = centerCell(face, PUZZLE_5X5)
        expect(after[center]).toBe(center)
      }
    },
  )

  it.each(ROTATIONS)(
    '%s turns the centres round with the rest of the cube',
    (move) => {
      const centers = FACES.map((face) => centerCell(face, PUZZLE_5X5))
      const after = applyMove(NUMBERED_5X5, move)
      expect(centers.some((center) => after[center] !== center)).toBe(true)
      expect(centers.map((center) => after[center]).sort()).toEqual(
        [...centers].sort(),
      )
    },
  )

  it.each(FACES)(
    "%s's inner layer leaves that face, the face opposite, and every corner, middle edge square and centre alone",
    (face) => {
      const after = applyMove(NUMBERED_5X5, face.toLowerCase() as Move)
      const opposite = FACES[(FACES.indexOf(face) + 3) % 6]
      for (const cell of [
        ...cells5(face, ALL),
        ...cells5(opposite, ALL),
        ...FACES.flatMap((f) => cells5(f, [0, 4, 20, 24, 2, 10, 14, 22, 12])),
      ]) {
        expect(after[cell]).toBe(cell)
      }
    },
  )

  it("turns the whole cube like Rw Lw', plus the middle layer between them, which has no move of its own", () => {
    for (const [rotation, wide] of [
      ['x', "Rw Lw'"],
      ['y', "Uw Dw'"],
      ['z', "Fw Bw'"],
    ] as const) {
      const whole = applyMove(NUMBERED_5X5, rotation)
      const outer = applyMoves(NUMBERED_5X5, parseMoves(wide))
      const differ = NUMBERED_5X5.filter((cell) => whole[cell] !== outer[cell])
      // The middle layer: the middle row or column of the four faces round it.
      expect(differ, rotation).toHaveLength(20)
    }
    const x = applyMove(NUMBERED_5X5, 'x')
    const differ = NUMBERED_5X5.filter(
      (cell) =>
        x[cell] !== applyMoves(NUMBERED_5X5, parseMoves("Rw Lw'"))[cell],
    )
    expect(differ.sort((a, b) => a - b)).toEqual(
      [
        ...column('U', 2),
        ...column('F', 2),
        ...column('D', 2),
        ...column('B', 2),
      ].sort((a, b) => a - b),
    )
  })

  // On the standard scheme: U white, D yellow, F green, B blue, R red, L orange.
  it('turns the inner layer the same way as its face: r lifts the front up over the top', () => {
    const after = applyMove(SOLVED_5X5, 'r')
    for (const cell of column('U', 3)) expect(after[cell]).toBe('green')
    for (const c of [0, 1, 2, 4]) {
      for (const cell of column('U', c)) expect(after[cell]).toBe('white')
    }
  })

  it("turns two layers with a wide turn: Rw lifts the front's right two columns up over the top", () => {
    const after = applyMove(SOLVED_5X5, 'Rw')
    for (const c of [3, 4]) {
      for (const cell of column('U', c)) expect(after[cell]).toBe('green')
    }
    for (const c of [0, 1, 2]) {
      for (const cell of column('U', c)) expect(after[cell]).toBe('white')
    }
  })

  it("u brings the right side's second row to the front; f lifts the left side's fourth column onto the top", () => {
    const u = applyMove(SOLVED_5X5, 'u')
    for (const cell of row('F', 1)) expect(u[cell]).toBe('red')
    for (const r of [0, 2, 3, 4]) {
      for (const cell of row('F', r)) expect(u[cell]).toBe('green')
    }
    const f = applyMove(SOLVED_5X5, 'f')
    for (const cell of row('U', 3)) expect(f[cell]).toBe('orange')
    for (const cell of row('U', 4)) expect(f[cell]).toBe('white')
  })

  it('moves its corners, middle edge squares and centres exactly as a 3x3 does', () => {
    // A 3x3 cell at (row, column) of a face matches the 5x5 cell at
    // (2 × row, 2 × column) of that face.
    const onFiveByFive = (cell: number) => {
      const face = Math.floor(cell / 9)
      const [r, c] = [Math.floor((cell % 9) / 3), cell % 3]
      return face * 25 + r * 2 * 5 + c * 2
    }
    const random = seededRandom(51)
    const moves = Array.from(
      { length: 60 },
      () => MOVES[Math.floor(random() * MOVES.length)],
    )
    const threeByThree = applyMoves(NUMBERED, moves)
    const fiveByFive = applyMoves(NUMBERED_5X5, moves)
    NUMBERED.forEach((cell) => {
      expect(fiveByFive[onFiveByFive(cell)]).toBe(
        onFiveByFive(threeByThree[cell]),
      )
    })
  })

  it('scrambles with every kind of turn, keeping 25 of each colour and the centres in place, and the inverse solves it', () => {
    const random = seededRandom(52)
    for (let run = 0; run < 50; run++) {
      const scramble = Array.from(
        { length: 40 },
        () => TURNS[Math.floor(random() * TURNS.length)],
      )
      const scrambled = applyMoves(SOLVED_5X5, scramble)
      for (const color of COLORS) {
        expect(colorCounts(scrambled)[color]).toBe(25)
      }
      for (const face of FACES) {
        expect(scrambled[centerCell(face, PUZZLE_5X5)]).toBe(
          STANDARD_SCHEME[face],
        )
      }
      expect(applyMoves(scrambled, invertMoves(scramble))).toEqual(SOLVED_5X5)
      expect(
        applyMoves(applyMoves(NUMBERED_5X5, scramble), invertMoves(scramble)),
      ).toEqual(NUMBERED_5X5)
    }
  })
})
