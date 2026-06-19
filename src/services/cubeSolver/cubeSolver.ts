import Cube from 'cubejs'
import { parseMoves } from '@/utils/cubeNotation'
import type { Move } from '@/types/cube'

/**
 * Wrapper around the cubejs library.
 *
 * `initSolver()` builds an internal pruning table (~30 MB, a few seconds the
 * first time) so we kick it off lazily and memoise the promise.
 */

let initPromise: Promise<void> | null = null

export function ensureSolverReady(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = new Promise<void>((resolve, reject) => {
    try {
      // Run on a microtask so the UI thread doesn't hitch immediately.
      setTimeout(() => {
        try {
          Cube.initSolver()
          resolve()
        } catch (err) {
          reject(err)
        }
      }, 0)
    } catch (err) {
      reject(err)
    }
  })
  return initPromise
}

export async function solveFacelets(facelets: string): Promise<Move[]> {
  await ensureSolverReady()
  const cube = Cube.fromString(facelets)
  if (cube.isSolved()) return []
  const solution = cube.solve(22)
  return parseMoves(solution)
}
