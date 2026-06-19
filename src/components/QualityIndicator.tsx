import type { QualityReport } from '@/types/cube'

interface Props {
  quality: QualityReport | null
  holdProgress: number
}

const METRICS: Array<{ key: keyof Pick<QualityReport, 'brightness' | 'sharpness' | 'alignment'>; label: string }> = [
  { key: 'brightness', label: 'Luz' },
  { key: 'sharpness', label: 'Foco' },
  { key: 'alignment', label: 'Enquadramento' },
]

export function QualityIndicator({ quality, holdProgress }: Props) {
  return (
    <div className="absolute inset-x-4 top-4 z-10 rounded-2xl bg-slate-900/70 p-3 text-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        {METRICS.map(({ key, label }) => {
          const v = quality ? Math.max(0, Math.min(1, quality[key])) : 0
          return (
            <div key={key} className="flex-1">
              <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">{label}</div>
              <div className="h-1.5 rounded-full bg-slate-700">
                <div
                  className={`h-full rounded-full ${v > 0.6 ? 'bg-emerald-400' : v > 0.35 ? 'bg-amber-400' : 'bg-rose-500'}`}
                  style={{ width: `${v * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {quality?.ok ? (
        <div className="mt-3">
          <div className="text-center text-sm font-medium text-emerald-300">Perfeito! Segure parado…</div>
          <div className="mt-1 h-1 rounded-full bg-slate-700">
            <div
              className="h-full rounded-full bg-emerald-400 transition-[width] duration-100"
              style={{ width: `${holdProgress * 100}%` }}
            />
          </div>
        </div>
      ) : (
        <ul className="mt-3 space-y-1 text-xs text-rose-300">
          {(quality?.issues ?? ['Aguardando câmera…']).map((msg) => (
            <li key={msg}>• {msg}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
