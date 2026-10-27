import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SolveRequest, SolverMessage } from './protocol.ts'
import {
  createSolver,
  SolverError,
  solverErrorMessage,
  type WorkerLike,
} from './solver.ts'

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
    await expect(first).resolves.toEqual(['R', "F'"])
    await expect(second).resolves.toEqual(['U'])
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
    await expect(retry).resolves.toEqual(['R'])
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
