import type { CubeColor, FaceName, Facelets } from '@/types/cube'
import { FACE_LABELS, HEX_FOR_COLOR } from '@/types/cube'

const PALETTE: CubeColor[] = ['white', 'yellow', 'red', 'orange', 'blue', 'green']

interface Props {
  face: FaceName
  facelets: Facelets
  onRecolor: (cellIndex: number, color: CubeColor) => void
  onRetake: () => void
}

/**
 * Editable thumbnail of a captured face. Tapping a sticker opens a small
 * palette so the user can correct the detected colour without rescanning.
 */
export function FacePreview({ face, facelets, onRecolor, onRetake }: Props) {
  return (
    <div className="rounded-2xl bg-slate-800/80 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold">
          {face} · {FACE_LABELS[face]}
        </div>
        <button
          onClick={onRetake}
          className="text-xs font-semibold text-amber-300 hover:text-amber-200"
        >
          Refazer captura
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {facelets.map((color, i) => (
          <CellEditor key={i} color={color} onPick={(c) => onRecolor(i, c)} />
        ))}
      </div>
    </div>
  )
}

function CellEditor({ color, onPick }: { color: CubeColor; onPick: (c: CubeColor) => void }) {
  return (
    <div className="group relative aspect-square overflow-visible">
      <div
        className="h-full w-full rounded-lg border border-white/20 shadow-inner"
        style={{ background: HEX_FOR_COLOR[color] }}
      />
      <details className="absolute inset-0">
        <summary className="block h-full w-full cursor-pointer rounded-lg opacity-0">
          edit
        </summary>
        <div className="absolute left-1/2 top-full z-20 mt-1 flex -translate-x-1/2 gap-1 rounded-lg bg-slate-900/95 p-1 shadow-xl">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={(e) => {
                e.preventDefault()
                onPick(c)
                ;(e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open')
              }}
              className="h-6 w-6 rounded border border-white/40"
              style={{ background: HEX_FOR_COLOR[c] }}
              aria-label={c}
            />
          ))}
        </div>
      </details>
    </div>
  )
}
