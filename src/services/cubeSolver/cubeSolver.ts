import { parseMoves } from '@/utils/cubeNotation'
import type { Move } from '@/types/cube'

/**
 * Public API around the solver Web Worker.
 *
 * The worker hosts cubejs and does the heavy `initSolver()` work off the main
 * thread, so the UI keeps responding while we build the pruning table.
 */

let worker: Worker | null = null
let initPromise: Promise<void> | null = null
let nextId = 1

interface Pending {
  resolve: (value: any) => void
  reject: (reason: Error) => void
}
const pending = new Map<number, Pending>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./solver.worker.ts', import.meta.url), {
    type: 'module',
    name: 'cube-solver',
  })
  worker.addEventListener('message', (event: MessageEvent) => {
    const { id, ok, error, code, ...rest } = event.data
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    if (ok) {
      entry.resolve(rest)
    } else {
      const err = new Error(error ?? 'Erro no solver') as Error & { code?: string }
      err.code = code
      entry.reject(err)
    }
  })
  worker.addEventListener('error', (event: ErrorEvent) => {
    const message = event.message || 'Worker do solver falhou'
    for (const [id, p] of pending) {
      pending.delete(id)
      p.reject(new Error(message))
    }
    initPromise = null
    worker = null
  })
  return worker
}

function call<T>(type: 'init' | 'solve', payload?: Record<string, unknown>): Promise<T> {
  const w = getWorker()
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ id, type, payload })
  })
}

let solverReady = false
const readyListeners = new Set<(ready: boolean) => void>()

export function isSolverReady(): boolean {
  return solverReady
}

export function onSolverReady(listener: (ready: boolean) => void): () => void {
  readyListeners.add(listener)
  return () => readyListeners.delete(listener)
}

export function ensureSolverReady(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = call<void>('init')
    .then(() => {
      solverReady = true
      for (const l of readyListeners) l(true)
    })
    .catch((err) => {
      initPromise = null
      throw err
    })
  return initPromise
}

export class ImpossibleCubeError extends Error {
  code = 'impossible'
  constructor(message: string) {
    super(message)
    this.name = 'ImpossibleCubeError'
  }
}

export async function solveFacelets(facelets: string): Promise<Move[]> {
  try {
    const { solution } = await call<{ solution: string }>('solve', { facelets })
    if (!solution) return []
    return parseMoves(solution)
  } catch (err: any) {
    if (err?.code === 'impossible') {
      throw new ImpossibleCubeError(err.message ?? 'estado impossível')
    }
    throw err
  }
}
