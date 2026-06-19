import { useMemo, useState } from 'react'
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
import { ImpossibleCubeError, solveFacelets } from '@/services/cubeSolver/cubeSolver'
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
  const [solving, setSolving] = useState(false)
  const [error, setError] = useState<ValidationResult | null>(null)
  const solverReady = useSolverReady()

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
    setSolving(true)
    setError(null)
    const result = validateCube(cube)
    if (!result.ok || !result.facelets) {
      setError(result)
      setSolving(false)
      return
    }
    try {
      const moves = await solveFacelets(result.facelets)
      setSolution(moves)
      setSolverError(null)
      setRoute('solver')
    } catch (err: any) {
      if (err instanceof ImpossibleCubeError) {
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
      setSolving(false)
    }
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
        ) : (
          <>
            <Button onClick={handleSolve} disabled={solving}>
              {solving ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-900/40 border-t-slate-900" />
                  Resolvendo…
                </span>
              ) : (
                'Resolver Cubo'
              )}
            </Button>
            {!solverReady && (
              <p className="text-center text-xs text-slate-400">
                Preparando o solver (primeira vez leva alguns segundos)…
              </p>
            )}
          </>
        )}
      </div>
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
