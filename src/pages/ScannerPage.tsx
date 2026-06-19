import { useMemo, useState } from 'react'
import { CameraView } from '@/components/CameraView'
import { FacePreview } from '@/components/FacePreview'
import { ScanProgress } from '@/components/ScanProgress'
import { Button } from '@/components/Button'
import { useAppStore } from '@/stores/cubeStore'
import { SCAN_ORDER } from '@/types/cube'
import type { CubeColor, FaceName, Facelets } from '@/types/cube'
import { validateCube } from '@/services/cubeValidation/validator'
import { solveFacelets } from '@/services/cubeSolver/cubeSolver'
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
  const [validationMsg, setValidationMsg] = useState<string | null>(null)
  const [suspectFaces, setSuspectFaces] = useState<FaceName[]>([])
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
  }

  async function handleSolve() {
    setSolving(true)
    setValidationMsg(null)
    setSuspectFaces([])
    const result = validateCube(cube)
    if (!result.ok || !result.facelets) {
      setValidationMsg(result.message ?? 'Validação falhou.')
      setSuspectFaces(result.suspectFaces)
      setSolving(false)
      return
    }
    try {
      const moves = await solveFacelets(result.facelets)
      setSolution(moves)
      setSolverError(null)
      setRoute('solver')
    } catch (err: any) {
      setSolverError(err?.message ?? 'Falha ao resolver o cubo.')
      setValidationMsg('Não foi possível resolver: o estado parece inválido. Recapture as faces suspeitas.')
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

      {validationMsg && (
        <div className="mt-4 rounded-2xl bg-rose-500/15 p-3 text-sm text-rose-200">
          {validationMsg}
          {suspectFaces.length > 0 && (
            <div className="mt-1 text-xs">Faces a revisar: {suspectFaces.join(', ')}</div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {SCAN_ORDER.map((face) => {
          const scanned = cube.faces[face]
          if (!scanned) return null
          return (
            <FacePreview
              key={face}
              face={face}
              facelets={scanned.facelets}
              onRecolor={(i, c) => recolorCell(face, i, c)}
              onRetake={() => {
                removeFace(face)
                setScanIndex(SCAN_ORDER.indexOf(face))
                setCameraOpen(true)
              }}
            />
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
