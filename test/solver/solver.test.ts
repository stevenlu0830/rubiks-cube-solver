import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PUZZLE_2X2,
  PUZZLE_3X3,
  PUZZLE_4X4,
  PUZZLE_5X5,
} from '../../src/cube/puzzle.ts'
import type { SolveRequest, SolverMessage } from '../../src/solver/protocol.ts'
import {
  createSolver,
  getSolver,
  hasSolver,
  SolverError,
  solverErrorMessage,
  type WorkerLike,
} from '../../src/solver/solver.ts'

/** Stands in for the solver's Web Worker; tests decide what it says back. */
class FakeWorker implements WorkerLike {
  sent: SolveRequest[] = []
  terminated = false
  onmessage: ((event: MessageEvent<SolverMessage>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  postMessage(request: SolveRequest) {
    this.sent.push(request)
  }
  terminate() {
    this.terminated = true
  }
  reply(message: SolverMessage) {
    this.onmessage?.({ data: message } as MessageEvent<SolverMessage>)
  }
  crash() {
    this.onerror?.(new ErrorEvent('error'))
  }
}

describe('createSolver', () => {
  let workers: FakeWorker[]
  const latest = () => workers.at(-1)!
  const makeSolver = () =>
    createSolver(() => {
      workers.push(new FakeWorker())
      return latest()
    }, 1000)

  beforeEach(() => {
    workers = []
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('starts the worker straight away and knows when it is ready', () => {
    const solver = makeSolver()
    expect(workers).toHaveLength(1)
    expect(solver.isReady()).toBe(false)
    latest().reply({ type: 'ready' })
    expect(solver.isReady()).toBe(true)
  })

  it('matches each answer to its question', async () => {
    const solver = makeSolver()
    const first = solver.solve('first cube')
    const second = solver.solve('second cube')
    const [a, b] = latest().sent
    expect(a.facelets).toBe('first cube')
    latest().reply({ type: 'solution', id: b.id, moves: ['U'] })
    latest().reply({ type: 'solution', id: a.id, moves: ['R', "F'"] })
    await expect(first).resolves.toEqual({ moves: ['R', "F'"], stages: [] })
    await expect(second).resolves.toEqual({ moves: ['U'], stages: [] })
  })

  it('gives up after the time limit and starts afresh on the next try', async () => {
    const solver = makeSolver()
    const stuck = solver.solve('cube')
    vi.advanceTimersByTime(1000)
    await expect(stuck).rejects.toMatchObject({ code: 'timeout' })
    expect(workers[0].terminated).toBe(true)

    const retry = solver.solve('cube')
    expect(workers).toHaveLength(2)
    latest().reply({ type: 'solution', id: latest().sent[0].id, moves: ['R'] })
    await expect(retry).resolves.toEqual({ moves: ['R'], stages: [] })
  })

  it('fails every waiting request when the worker crashes', async () => {
    const solver = makeSolver()
    const a = solver.solve('a')
    const b = solver.solve('b')
    latest().crash()
    await expect(a).rejects.toMatchObject({ code: 'unavailable' })
    await expect(b).rejects.toMatchObject({ code: 'unavailable' })
    expect(solver.isReady()).toBe(false)
  })

  it('passes on the solver’s own errors', async () => {
    const solver = makeSolver()
    const request = solver.solve('cube')
    latest().reply({ type: 'error', id: latest().sent[0].id, message: 'oops' })
    await expect(request).rejects.toMatchObject({ code: 'failed' })
  })
})

describe('solverErrorMessage', () => {
  it.each([
    ['timeout', 'took too long'],
    ['unavailable', "couldn't start"],
    ['failed', "couldn't solve this cube"],
  ] as const)('explains a %s error', (code, words) => {
    expect(solverErrorMessage(new SolverError(code, ''))).toContain(words)
  })

  it('treats unexpected errors as a failed solve', () => {
    expect(solverErrorMessage(new Error('?'))).toContain(
      "couldn't solve this cube",
    )
  })
})

describe('getSolver', () => {
  afterEach(() => vi.unstubAllGlobals())

  it("starts each cube's own worker, once: the 2x2 page never loads the 3x3's solver", () => {
    const started: string[] = []
    vi.stubGlobal(
      'Worker',
      class extends FakeWorker {
        constructor(url: URL) {
          super()
          started.push(String(url))
        }
      },
    )
    const twoByTwo = getSolver(PUZZLE_2X2)
    expect(getSolver(PUZZLE_2X2)).toBe(twoByTwo)
    expect(started).toHaveLength(1)
    expect(started[0]).toContain('twoByTwo.worker')

    const threeByThree = getSolver(PUZZLE_3X3)
    expect(threeByThree).not.toBe(twoByTwo)
    expect(getSolver()).toBe(threeByThree) // a 3x3 unless told
    expect(started).toHaveLength(2)
    expect(started[1]).toContain('solver.worker')
  })
})

describe('hasSolver', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('says which cubes have a solver so far: not the 5x5 yet', () => {
    expect(hasSolver(PUZZLE_2X2)).toBe(true)
    expect(hasSolver(PUZZLE_3X3)).toBe(true)
    expect(hasSolver(PUZZLE_4X4)).toBe(true)
    expect(hasSolver(PUZZLE_5X5)).toBe(false)
  })

  it("won't start a solver for a 5x5, and starts no worker trying", () => {
    const started = vi.fn()
    vi.stubGlobal(
      'Worker',
      class extends FakeWorker {
        constructor() {
          super()
          started()
        }
      },
    )
    expect(() => getSolver(PUZZLE_5X5)).toThrow("There's no 5x5 solver yet")
    expect(started).not.toHaveBeenCalled()
  })
})

describe('a 4x4 solution', () => {
  it('passes on where each stage starts', async () => {
    let worker!: FakeWorker
    const solver = createSolver(() => (worker = new FakeWorker()))
    const solving = solver.solve('a 4x4')
    const stages = [
      { name: 'centres', start: 0 },
      { name: 'finish', start: 2 },
    ] as const
    worker.reply({
      type: 'solution',
      id: worker.sent[0].id,
      moves: ['r', 'u', 'R'],
      stages: [...stages],
    })
    await expect(solving).resolves.toEqual({
      moves: ['r', 'u', 'R'],
      stages,
    })
  })

  it("starts the 4x4's own worker", () => {
    const started: string[] = []
    vi.stubGlobal(
      'Worker',
      class extends FakeWorker {
        constructor(url: URL) {
          super()
          started.push(String(url))
        }
      },
    )
    getSolver(PUZZLE_4X4)
    expect(started).toHaveLength(1)
    expect(started[0]).toContain('fourByFour.worker')
    vi.unstubAllGlobals()
  })
})
