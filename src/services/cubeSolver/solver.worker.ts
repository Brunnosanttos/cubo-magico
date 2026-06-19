/// <reference lib="webworker" />

/**
 * Solver Web Worker.
 *
 * `Cube.initSolver()` from the cubejs library builds a ~30 MB pruning table
 * synchronously and blocks for several seconds on mobile devices. Running it
 * in a worker keeps the main thread (and the UI) responsive.
 */

import Cube from 'cubejs'

declare const self: DedicatedWorkerGlobalScope

let solverReady = false

function ensureReady() {
  if (solverReady) return
  Cube.initSolver()
  solverReady = true
}

self.onmessage = (event: MessageEvent) => {
  const { id, type, payload } = event.data as {
    id: number
    type: 'init' | 'solve'
    payload?: { facelets?: string }
  }

  try {
    if (type === 'init') {
      ensureReady()
      self.postMessage({ id, ok: true })
      return
    }

    if (type === 'solve') {
      ensureReady()
      const facelets = payload?.facelets
      if (!facelets) throw new Error('facelets não informados')
      const cube = Cube.fromString(facelets)
      const solution = cube.isSolved() ? '' : cube.solve(22)
      self.postMessage({ id, ok: true, solution })
      return
    }

    throw new Error(`Mensagem desconhecida: ${type}`)
  } catch (err: any) {
    self.postMessage({
      id,
      ok: false,
      error: err?.message ?? String(err) ?? 'Erro desconhecido',
    })
  }
}
