import { FACE_LABELS, SCAN_ORDER } from '@/types/cube'
import { useAppStore } from '@/stores/cubeStore'

export function ScanProgress() {
  const cube = useAppStore((s) => s.cube)
  const scanIndex = useAppStore((s) => s.scanIndex)

  return (
    <div className="flex items-center justify-between gap-2 px-2 text-xs">
      {SCAN_ORDER.map((face, i) => {
        const done = !!cube.faces[face]
        const active = i === scanIndex && !done
        return (
          <div
            key={face}
            className={`flex flex-1 flex-col items-center rounded-lg p-2 ${
              done ? 'bg-emerald-500/20 text-emerald-200' : active ? 'bg-amber-400/20 text-amber-200' : 'bg-slate-800 text-slate-400'
            }`}
          >
            <span className="font-bold">{face}</span>
            <span className="text-[10px]">{FACE_LABELS[face]}</span>
          </div>
        )
      })}
    </div>
  )
}
