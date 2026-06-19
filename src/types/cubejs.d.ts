declare module 'cubejs' {
  export default class Cube {
    constructor(state?: number[])
    static fromString(facelets: string): Cube
    static initSolver(): void
    static random(): Cube
    asString(): string
    solve(maxDepth?: number): string
    move(moves: string): Cube
    isSolved(): boolean
  }
}
