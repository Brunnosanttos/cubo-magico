import { useEffect } from 'react'
import { GridOverlay } from './GridOverlay'
import { QualityIndicator } from './QualityIndicator'
import { useCamera } from '@/hooks/useCamera'
import { useColorDetection } from '@/hooks/useColorDetection'
import { useStableCapture } from '@/hooks/useStableCapture'
import { useAppStore } from '@/stores/cubeStore'
import { loadOpenCV } from '@/services/colorDetection/opencvLoader'
import { FACE_LABELS, SCAN_INSTRUCTIONS, SCAN_ORDER } from '@/types/cube'
import type { CubeColor, Facelets, FaceName } from '@/types/cube'
import { Button } from './Button'

interface Props {
  onCaptured: (face: FaceName, colors: CubeColor[], hsv: Array<{ h: number; s: number; v: number }>) => void
  onCancel: () => void
  /** Which face slot is currently being scanned. */
  face: FaceName
}

export function CameraView({ onCaptured, onCancel, face }: Props) {
  const { videoRef, ready, error } = useCamera()
  const calibration = useAppStore((s) => s.calibration)
  const detection = useColorDetection(videoRef, ready, calibration)

  useEffect(() => {
    // Kick off OpenCV load in the background.
    loadOpenCV().catch(() => undefined)
  }, [])

  const { progress, reset } = useStableCapture(detection.quality, () => {
    if (!detection.colors.length) return
    onCaptured(
      face,
      detection.colors as CubeColor[],
      detection.cells.map(({ h, s, v }) => ({ h, s, v })),
    )
    reset()
  }, 1000)

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        muted
        autoPlay
        playsInline
      />

      {/* Header instructions */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3">
        <div className="rounded-2xl bg-slate-900/70 px-3 py-2 text-sm backdrop-blur">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Face {SCAN_ORDER.indexOf(face) + 1} de 6
          </div>
          <div className="font-semibold">{face} · {FACE_LABELS[face]}</div>
        </div>
        <Button variant="ghost" onClick={onCancel} className="px-3 py-2 text-sm">
          Cancelar
        </Button>
      </div>

      <QualityIndicator quality={detection.quality} holdProgress={progress} />

      <GridOverlay
        colors={detection.colors as CubeColor[]}
        highlight={!!detection.quality?.ok}
      />

      <div className="absolute inset-x-4 bottom-4 z-10 rounded-2xl bg-slate-900/70 p-3 text-center text-sm backdrop-blur">
        {SCAN_INSTRUCTIONS[face]}
      </div>

      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/90 p-6 text-center">
          <div>
            <div className="mb-3 text-lg font-semibold text-rose-300">Erro de câmera</div>
            <div className="text-sm text-slate-300">{error}</div>
            <Button className="mt-4" onClick={onCancel}>
              Voltar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Helper so callers can normalise the 9-colour array into a tuple. */
export function asFacelets(colors: CubeColor[]): Facelets {
  return colors.slice(0, 9) as Facelets
}
