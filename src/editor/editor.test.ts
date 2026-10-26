import { describe, expect, it } from 'vitest'
import {
  CENTER,
  cellIndex,
  colorCounts,
  COLORS,
  emptyState,
  FACES,
  solvedState,
  STANDARD_SCHEME,
  type Color,
} from '../cube/state.ts'
import {
  centersFilled,
  editorReducer,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from './editor.ts'

const run = (
  actions: EditorAction[],
  start = initialEditorState(),
): EditorState => actions.reduce(editorReducer, start)

const paint = (cell: number, color: Color): EditorAction => ({
  type: 'paint',
  cell,
  color,
})

const allCounts = (n: number) =>
  Object.fromEntries(COLORS.map((color) => [color, n])) as Record<Color, number>

describe('painting', () => {
  it('paints a cell with the chosen colour', () => {
    expect(run([paint(5, 'red')]).cube[5]).toBe('red')
  })

  it('clears a cell when it is painted the same colour again', () => {
    expect(run([paint(5, 'red'), paint(5, 'red')]).cube[5]).toBeNull()
  })

  it('replaces the colour when painted a different one', () => {
    expect(run([paint(5, 'red'), paint(5, 'blue')]).cube[5]).toBe('blue')
  })

  it('can paint every one of the 54 cells', () => {
    const target = solvedState()
    const { cube } = run(target.map((color, cell) => paint(cell, color!)))
    expect(cube).toEqual(target)
  })

  it('never changes the previous state', () => {
    const before = initialEditorState()
    editorReducer(before, paint(0, 'green'))
    expect(before.cube).toEqual(emptyState())
  })
})

describe('colorCounts', () => {
  it('counts nothing on a blank cube', () => {
    expect(colorCounts(emptyState())).toEqual(allCounts(0))
  })

  it('counts 9 of each colour on a cube painted solved', () => {
    const { cube } = run(
      solvedState().map((color, cell) => paint(cell, color!)),
    )
    expect(colorCounts(cube)).toEqual(allCounts(9))
  })

  it('stays correct when cells are repainted and cleared', () => {
    const solved = initialEditorState(solvedState())
    const repainted = run([paint(0, 'red')], solved) // a white cell becomes red
    expect(colorCounts(repainted.cube)).toMatchObject({ white: 8, red: 10 })
    const cleared = run([paint(0, 'red')], repainted) // and is then cleared
    expect(colorCounts(cleared.cube)).toMatchObject({ white: 8, red: 9 })
  })
})

describe('undo', () => {
  it('steps back one change at a time', () => {
    const state = run([paint(1, 'red'), paint(2, 'blue'), { type: 'undo' }])
    expect(state.cube[1]).toBe('red')
    expect(state.cube[2]).toBeNull()
    expect(run([{ type: 'undo' }], state).cube).toEqual(emptyState())
  })

  it('does nothing when there is nothing to undo', () => {
    const state = initialEditorState()
    expect(editorReducer(state, { type: 'undo' })).toBe(state)
  })

  it('keeps at most 200 steps', () => {
    const taps = Array.from({ length: 250 }, (_, i) =>
      paint(0, i % 2 ? 'red' : 'blue'),
    )
    expect(run(taps).history).toHaveLength(200)
  })
})

describe('reset', () => {
  it('clears every cell, and can be undone', () => {
    const painted = initialEditorState(solvedState())
    const reset = run([{ type: 'reset' }], painted)
    expect(reset.cube).toEqual(emptyState())
    expect(run([{ type: 'undo' }], reset).cube).toEqual(solvedState())
  })

  it('adds no undo step when the cube is already blank', () => {
    expect(run([{ type: 'reset' }]).history).toHaveLength(0)
  })
})

describe('fillCenters', () => {
  it('paints the six centres in the standard scheme and nothing else', () => {
    const { cube } = run([{ type: 'fillCenters' }])
    for (const face of FACES) {
      expect(cube[cellIndex(face, CENTER)]).toBe(STANDARD_SCHEME[face])
    }
    expect(cube.filter((cell) => cell !== null)).toHaveLength(6)
    expect(centersFilled(cube)).toBe(true)
  })

  it('leaves other painted cells alone', () => {
    expect(run([paint(0, 'red'), { type: 'fillCenters' }]).cube[0]).toBe('red')
  })

  it('can be undone', () => {
    expect(run([{ type: 'fillCenters' }, { type: 'undo' }]).cube).toEqual(
      emptyState(),
    )
  })
})
