/// <reference lib="webworker" />

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
      if (!facelets) throw makeError('bad-input', 'facelets não informados')

      let cube: Cube
      try {
        cube = Cube.fromString(facelets)
      } catch (e: any) {
        throw makeError('impossible', e?.message ?? 'estado de cubo inválido')
      }

      if (cube.isSolved()) {
        self.postMessage({ id, ok: true, solution: '' })
        return
      }

      let solution: string
      try {
        solution = cube.solve(22)
      } catch (e: any) {
        throw makeError('impossible', e?.message ?? 'cubo não pode ser montado')
      }

      // cubejs returns an empty / non-string value when the state is invalid.
      if (typeof solution !== 'string' || solution.length === 0) {
        throw makeError('impossible', 'cubejs não retornou uma solução')
      }

      self.postMessage({ id, ok: true, solution })
      return
    }

    throw makeError('bad-input', `Mensagem desconhecida: ${type}`)
  } catch (err: any) {
    self.postMessage({
      id,
      ok: false,
      error: err?.message ?? String(err) ?? 'Erro desconhecido',
      code: err?.code ?? 'unknown',
    })
  }
}

function makeError(code: 'impossible' | 'bad-input', message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string }
  err.code = code
  return err
}
