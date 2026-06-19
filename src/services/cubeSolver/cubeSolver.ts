import { parseMoves } from '@/utils/cubeNotation'
import type { Move } from '@/types/cube'

/**
 * Public API around the solver Web Worker.
 *
 * The worker hosts cubejs and does the heavy `initSolver()` work off the main
 * thread, so the UI keeps responding while we build the pruning table.
 *
 * Solves are guarded by a wall-clock timeout because cubejs's IDA* search
 * does not always reject a physically-impossible state up-front — it can
 * spend minutes exhausting the depth-22 search space before giving up.
 * When the timeout fires we terminate the worker (the only reliable way to
 * stop the synchronous solver loop) and surface an ImpossibleCubeError.
 */

let worker: Worker | null = null
let initPromise: Promise<void> | null = null
let nextId = 1

interface Pending {
  resolve: (value: any) => void
  reject: (reason: Error) => void
  /** Set by the timeout machinery so we can clear it once a response lands. */
  cancelTimeout?: () => void
}
const pending = new Map<number, Pending>()

const SOLVE_TIMEOUT_MS = 15_000

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
    entry.cancelTimeout?.()
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
    failAllPending(new Error(message))
    resetWorker()
  })
  return worker
}

function failAllPending(err: Error) {
  for (const [id, p] of pending) {
    pending.delete(id)
    p.cancelTimeout?.()
    p.reject(err)
  }
}

/**
 * Hard reset: terminate the current worker (it might be stuck inside a
 * runaway solve) and clear local state so the next call boots a fresh one.
 */
function resetWorker() {
  if (worker) {
    try {
      worker.terminate()
    } catch {
      // ignore
    }
  }
  worker = null
  initPromise = null
  solverReady = false
  for (const l of readyListeners) l(false)
}

function call<T>(
  type: 'init' | 'solve',
  payload?: Record<string, unknown>,
  timeoutMs?: number,
): Promise<T> {
  const w = getWorker()
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    let timer: number | null = null
    const entry: Pending = { resolve, reject }
    if (timeoutMs && timeoutMs > 0) {
      timer = window.setTimeout(() => {
        if (!pending.has(id)) return
        pending.delete(id)
        // Worker is stuck in a synchronous loop — only termination can stop it.
        resetWorker()
        const err = new Error('timeout — cubo provavelmente inválido') as Error & { code: string }
        err.code = 'impossible'
        reject(err)
      }, timeoutMs)
      entry.cancelTimeout = () => {
        if (timer !== null) window.clearTimeout(timer)
      }
    }
    pending.set(id, entry)
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
  // Ensure the pruning table is built before the timer starts ticking on the
  // solve itself; otherwise initSolver's 5–10 s on a cold worker would burn
  // most of our 15 s budget.
  await ensureSolverReady()
  try {
    const { solution } = await call<{ solution: string }>(
      'solve',
      { facelets },
      SOLVE_TIMEOUT_MS,
    )
    if (!solution) return []
    return parseMoves(solution)
  } catch (err: any) {
    if (err?.code === 'impossible') {
      throw new ImpossibleCubeError(err.message ?? 'estado impossível')
    }
    throw err
  }
}
