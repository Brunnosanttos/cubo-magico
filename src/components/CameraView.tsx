import { useEffect, useState } from 'react'
import { GridOverlay } from './GridOverlay'
import { QualityIndicator } from './QualityIndicator'
import { useCamera } from '@/hooks/useCamera'
import { useColorDetection } from '@/hooks/useColorDetection'
import { useStableCapture } from '@/hooks/useStableCapture'
import { useAppStore } from '@/stores/cubeStore'
import { loadOpenCV } from '@/services/colorDetection/opencvLoader'
import { FACE_LABELS, HEX_FOR_COLOR, SCAN_INSTRUCTIONS, SCAN_ORDER } from '@/types/cube'
import type { CubeColor, Facelets, FaceName } from '@/types/cube'
import { Button } from './Button'

interface Props {
  onCaptured: (face: FaceName, colors: CubeColor[], hsv: Array<{ h: number; s: number; v: number }>) => void
  onCancel: () => void
  /** Which face slot is currently being scanned. */
  face: FaceName
}

interface CapturedSnapshot {
  colors: CubeColor[]
  hsv: Array<{ h: number; s: number; v: number }>
  /** A frozen frame from the moment of capture, drawn into an offscreen canvas. */
  thumbnailUrl: string
}

const HOLD_MS = 1500

export function CameraView({ onCaptured, onCancel, face }: Props) {
  const { videoRef, ready, error } = useCamera()
  const calibration = useAppStore((s) => s.calibration)
  const [captured, setCaptured] = useState<CapturedSnapshot | null>(null)
  // Pause live detection while the user is reviewing the captured frame.
  const detection = useColorDetection(videoRef, ready && !captured, calibration)

  useEffect(() => {
    loadOpenCV().catch(() => undefined)
  }, [])

  const { progress, reset } = useStableCapture(
    captured ? null : detection.quality,
    () => {
      if (!detection.colors.length) return
      const thumbnailUrl = grabThumbnail(videoRef.current)
      setCaptured({
        colors: [...detection.colors] as CubeColor[],
        hsv: detection.cells.map(({ h, s, v }) => ({ h, s, v })),
        thumbnailUrl,
      })
      reset()
    },
    HOLD_MS,
  )

  function confirm() {
    if (!captured) return
    onCaptured(face, captured.colors, captured.hsv)
    setCaptured(null)
  }

  function retake() {
    setCaptured(null)
    reset()
  }

  function recolorCell(i: number, color: CubeColor) {
    if (!captured) return
    const next = [...captured.colors]
    next[i] = color
    setCaptured({ ...captured, colors: next })
  }

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

      {!captured && (
        <>
          <QualityIndicator quality={detection.quality} holdProgress={progress} />
          <GridOverlay
            colors={detection.colors as CubeColor[]}
            highlight={!!detection.quality?.ok}
          />
          <div className="absolute inset-x-4 bottom-4 z-10 rounded-2xl bg-slate-900/70 p-3 text-center text-sm backdrop-blur">
            {SCAN_INSTRUCTIONS[face]}
          </div>
        </>
      )}

      {captured && (
        <ConfirmOverlay
          face={face}
          colors={captured.colors}
          thumbnailUrl={captured.thumbnailUrl}
          onConfirm={confirm}
          onRetake={retake}
          onRecolor={recolorCell}
        />
      )}

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

/* ----------------------- Confirmation overlay ---------------------------- */

const PALETTE: CubeColor[] = ['white', 'yellow', 'red', 'orange', 'blue', 'green']

interface ConfirmProps {
  face: FaceName
  colors: CubeColor[]
  thumbnailUrl: string
  onConfirm: () => void
  onRetake: () => void
  onRecolor: (i: number, c: CubeColor) => void
}

function ConfirmOverlay({ face, colors, thumbnailUrl, onConfirm, onRetake, onRecolor }: ConfirmProps) {
  const [editing, setEditing] = useState<number | null>(null)

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-slate-950/85 backdrop-blur">
      <div className="px-4 pt-16 text-center">
        <div className="text-xs uppercase tracking-wide text-slate-400">
          Confirme a leitura · face {face} ({FACE_LABELS[face]})
        </div>
        <h2 className="mt-1 text-lg font-semibold">Está tudo certo?</h2>
        <p className="mt-1 text-xs text-slate-400">
          Toque em qualquer adesivo para trocar a cor.
        </p>
      </div>

      <div className="mx-auto mt-4 grid w-full max-w-xs gap-3 px-4">
        <div className="relative">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt="Frame capturado"
              className="aspect-square w-full rounded-xl object-cover opacity-60"
            />
          ) : (
            <div className="aspect-square w-full rounded-xl bg-slate-800" />
          )}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1 p-2">
            {colors.map((color, i) => (
              <button
                key={i}
                onClick={() => setEditing(editing === i ? null : i)}
                className={`flex items-center justify-center rounded-md border-2 ${
                  editing === i ? 'border-emerald-300 ring-2 ring-emerald-300/40' : 'border-white/70'
                }`}
                style={{ background: HEX_FOR_COLOR[color] }}
                aria-label={`Cor ${i + 1}: ${color}`}
              />
            ))}
          </div>
        </div>

        {editing !== null && (
          <div className="rounded-xl bg-slate-800/90 p-3">
            <div className="mb-2 text-xs text-slate-400">
              Corrigir cor do adesivo {editing + 1}
            </div>
            <div className="flex justify-between gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    onRecolor(editing, c)
                    setEditing(null)
                  }}
                  className="h-10 w-10 rounded-lg border-2 border-white/40"
                  style={{ background: HEX_FOR_COLOR[c] }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 p-4">
        <Button variant="secondary" onClick={onRetake}>
          ↻ Refazer
        </Button>
        <Button onClick={onConfirm}>
          ✓ Confirmar
        </Button>
      </div>
    </div>
  )
}

/* ---------------------- Helpers ----------------------------------------- */

/** Snapshot the current video frame as a data URL for the confirmation card. */
function grabThumbnail(video: HTMLVideoElement | null): string {
  if (!video || !video.videoWidth) return ''
  const W = video.videoWidth
  const H = video.videoHeight
  // Crop to the central square — matches what the user was framing.
  const size = Math.min(W, H)
  const sx = (W - size) / 2
  const sy = (H - size) / 2
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 320
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(video, sx, sy, size, size, 0, 0, 320, 320)
  try {
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    return ''
  }
}

/** Helper so callers can normalise the 9-colour array into a tuple. */
export function asFacelets(colors: CubeColor[]): Facelets {
  return colors.slice(0, 9) as Facelets
}
