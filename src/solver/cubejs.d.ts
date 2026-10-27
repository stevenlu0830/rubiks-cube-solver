// Types for the parts of the cubejs library this app uses (it ships none).
declare module 'cubejs' {
  export default class Cube {
    /** Builds the solver's lookup tables. Slow: call once before solving. */
    static initSolver(): void
    /** A cube from 54 face letters, e.g. "UUUUUUUUURRRRRRRRRFFF…" when solved. */
    static fromString(facelets: string): Cube
    constructor()
    /** Applies moves written in cube notation, e.g. "R U2 F'". */
    move(algorithm: string): Cube
    asString(): string
    isSolved(): boolean
    /** Kociemba's two-phase algorithm: face turns that solve the cube, e.g. "R U2 F'". */
    solve(maxDepth?: number): string
  }
}
