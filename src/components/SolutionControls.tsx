import { Button } from './Button'
import { describeMove } from '@/utils/cubeNotation'
import type { Move } from '@/types/cube'

interface Props {
  moves: Move[]
  step: number
  playing: boolean
  onPrev: () => void
  onNext: () => void
  onTogglePlay: () => void
  onRestart: () => void
}

export function SolutionControls({
  moves,
  step,
  playing,
  onPrev,
  onNext,
  onTogglePlay,
  onRestart,
}: Props) {
  const current = moves[step]
  const done = step >= moves.length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>Movimento {Math.min(step + 1, moves.length)} / {moves.length}</span>
        <span className="font-mono text-emerald-300">{current?.raw ?? '✓'}</span>
      </div>

      <div className="h-1.5 rounded-full bg-slate-700">
        <div
          className="h-full rounded-full bg-emerald-400 transition-[width] duration-200"
          style={{ width: `${(step / Math.max(1, moves.length)) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl bg-slate-800/80 p-3 text-center text-sm">
        {done ? '✓ Cubo resolvido!' : current ? describeMove(current) : 'Aguardando…'}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onPrev} disabled={step === 0}>
          ← Anterior
        </Button>
        <Button onClick={onNext} disabled={done}>
          Próximo →
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onTogglePlay} disabled={done}>
          {playing ? 'Pausar' : 'Reproduzir'}
        </Button>
        <Button variant="ghost" onClick={onRestart}>
          Reiniciar
        </Button>
      </div>

      <div className="rounded-xl bg-slate-900/50 p-2 font-mono text-xs leading-relaxed text-slate-300">
        {moves.map((m, i) => (
          <span
            key={i}
            className={`mr-2 inline-block ${
              i === step ? 'rounded bg-emerald-400/30 px-1 text-emerald-100' : i < step ? 'text-slate-500' : ''
            }`}
          >
            {m.raw}
          </span>
        ))}
      </div>
    </div>
  )
}
