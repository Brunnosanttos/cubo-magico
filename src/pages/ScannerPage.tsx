import { useEffect, useMemo, useRef, useState } from 'react'
import { CameraView } from '@/components/CameraView'
import { FacePreview } from '@/components/FacePreview'
import { ScanProgress } from '@/components/ScanProgress'
import { Button } from '@/components/Button'
import { useAppStore } from '@/stores/cubeStore'
import { FACE_LABELS, SCAN_ORDER } from '@/types/cube'
import type { CubeColor, FaceName, Facelets } from '@/types/cube'
import {
  impossibleStateResult,
  validateCube,
  type ValidationResult,
} from '@/services/cubeValidation/validator'
import {
  ImpossibleCubeError,
  abortSolver,
  ensureSolverReady,
  solveFacelets,
} from '@/services/cubeSolver/cubeSolver'
import { useSolverReady } from '@/hooks/useSolverReady'

export function ScannerPage() {
  const cube = useAppStore((s) => s.cube)
  const scanIndex = useAppStore((s) => s.scanIndex)
  const setFace = useAppStore((s) => s.setFace)
  const recolorCell = useAppStore((s) => s.recolorCell)
  const removeFace = useAppStore((s) => s.removeFace)
  const advanceScan = useAppStore((s) => s.advanceScan)
  const setScanIndex = useAppStore((s) => s.setScanIndex)
  const setRoute = useAppStore((s) => s.setRoute)
  const setSolution = useAppStore((s) => s.setSolution)
  const setSolverError = useAppStore((s) => s.setSolverError)

  const [cameraOpen, setCameraOpen] = useState(true)
  const [solving, setSolving] = useState<null | 'init' | 'solve'>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<ValidationResult | null>(null)
  const solverReady = useSolverReady()
  const tickRef = useRef<number | null>(null)

  useEffect(() => {
    if (!solving) {
      setElapsedMs(0)
      if (tickRef.current) {
        window.clearInterval(tickRef.current)
        tickRef.current = null
      }
      return
    }
    const start = performance.now()
    tickRef.current = window.setInterval(() => {
      setElapsedMs(performance.now() - start)
    }, 100)
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [solving])

  const currentFace: FaceName | null = scanIndex < SCAN_ORDER.length ? SCAN_ORDER[scanIndex] : null
  const allScanned = useMemo(
    () => SCAN_ORDER.every((f) => !!cube.faces[f]),
    [cube.faces],
  )

  function handleCaptured(face: FaceName, colors: CubeColor[], hsv: Array<{ h: number; s: number; v: number }>) {
    const facelets = colors.slice(0, 9) as Facelets
    setFace(face, { face, facelets, hsv })
    advanceScan()
    setCameraOpen(false)
    setError(null)
  }

  function retakeFace(face: FaceName) {
    removeFace(face)
    setScanIndex(SCAN_ORDER.indexOf(face))
    setError(null)
    setCameraOpen(true)
  }

  async function handleSolve() {
    setError(null)
    const result = validateCube(cube)
    if (!result.ok || !result.facelets) {
      setError(result)
      return
    }
    try {
      setSolving('init')
      await ensureSolverReady()
      setSolving('solve')
      const moves = await solveFacelets(result.facelets)
      setSolution(moves)
      setSolverError(null)
      setRoute('solver')
    } catch (err: any) {
      if (err?.code === 'aborted') {
        // User pressed Cancelar — silently bail.
      } else if (err instanceof ImpossibleCubeError) {
        setError(impossibleStateResult())
      } else {
        setError({
          ok: false,
          suspectFaces: [],
          message: err?.message ?? 'Falha ao resolver o cubo.',
          kind: 'impossible-state',
        })
      }
      setSolverError(err?.message ?? null)
    } finally {
      setSolving(null)
    }
  }

  function cancelSolve() {
    abortSolver()
    setSolving(null)
  }

  if (cameraOpen && currentFace) {
    return (
      <div className="fixed inset-0 z-50">
        <CameraView
          face={currentFace}
          onCaptured={handleCaptured}
          onCancel={() => setCameraOpen(false)}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <Button variant="ghost" className="px-3 py-2 text-sm" onClick={() => setRoute('home')}>
          ← Início
        </Button>
        <h1 className="text-lg font-semibold">Escaneamento</h1>
        <div className="w-12" />
      </header>

      <ScanProgress />

      {error && <ValidationErrorBanner error={error} onRetake={retakeFace} />}

      <div className="mt-4 space-y-3">
        {SCAN_ORDER.map((face) => {
          const scanned = cube.faces[face]
          if (!scanned) return null
          const isSuspect = error?.suspectFaces.includes(face)
          return (
            <div
              key={face}
              className={isSuspect ? 'rounded-2xl ring-2 ring-rose-400/70' : undefined}
            >
              <FacePreview
                face={face}
                facelets={scanned.facelets}
                onRecolor={(i, c) => recolorCell(face, i, c)}
                onRetake={() => retakeFace(face)}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-6 grid gap-2">
        {!allScanned ? (
          <Button
            onClick={() => {
              if (currentFace) setCameraOpen(true)
            }}
          >
            📷 Escanear {currentFace ? `face ${currentFace}` : ''}
          </Button>
        ) : solving ? (
          <SolveStatus phase={solving} elapsedMs={elapsedMs} onCancel={cancelSolve} />
        ) : (
          <>
            <Button onClick={handleSolve}>Resolver Cubo</Button>
            {!solverReady && (
              <p className="text-center text-xs text-slate-400">
                Preparando o solver em segundo plano…
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface SolveStatusProps {
  phase: 'init' | 'solve'
  elapsedMs: number
  onCancel: () => void
}

function SolveStatus({ phase, elapsedMs, onCancel }: SolveStatusProps) {
  const secs = (elapsedMs / 1000).toFixed(1)
  const headline =
    phase === 'init' ? 'Preparando o solver…' : 'Resolvendo o cubo…'
  const hint =
    phase === 'init'
      ? 'A tabela de busca leva alguns segundos na primeira vez.'
      : 'Cubos válidos resolvem em até 2 s — se passar de 10 s, provavelmente as faces foram lidas erradas.'
  return (
    <div className="rounded-2xl bg-slate-800/80 p-4">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300/40 border-t-emerald-300" />
        <div className="flex-1">
          <div className="text-sm font-semibold">{headline}</div>
          <div className="text-xs text-slate-400">{hint}</div>
        </div>
        <div className="font-mono text-sm text-emerald-300">{secs}s</div>
      </div>
      <button
        onClick={onCancel}
        className="mt-3 w-full rounded-xl bg-slate-700 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600"
      >
        Cancelar
      </button>
    </div>
  )
}

interface BannerProps {
  error: ValidationResult
  onRetake: (face: FaceName) => void
}

function ValidationErrorBanner({ error, onRetake }: BannerProps) {
  const headline =
    error.kind === 'impossible-state'
      ? '❌ Cubo impossível'
      : error.kind === 'color-count'
        ? '⚠ Cores inconsistentes'
        : error.kind === 'duplicate-centres'
          ? '⚠ Centros duplicados'
          : '⚠ Algo está errado'

  return (
    <div className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
      <div className="font-semibold">{headline}</div>
      <p className="mt-1 text-rose-200/90">{error.message}</p>
      {error.details && (
        <p className="mt-1 font-mono text-xs text-rose-200/80">{error.details}</p>
      )}
      {error.suspectFaces.length > 0 && (
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wide text-rose-200/70">
            Recapture as faces suspeitas:
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {error.suspectFaces.map((face) => (
              <button
                key={face}
                onClick={() => onRetake(face)}
                className="rounded-lg bg-rose-600/30 px-3 py-1.5 text-xs font-medium text-rose-50 hover:bg-rose-600/50"
              >
                ↻ {face} · {FACE_LABELS[face]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
