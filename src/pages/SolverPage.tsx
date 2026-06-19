import { useEffect, useRef, useState } from 'react'
import { Cube3D } from '@/components/Cube3D'
import { SolutionControls } from '@/components/SolutionControls'
import { Button } from '@/components/Button'
import { useAppStore } from '@/stores/cubeStore'

const STEP_INTERVAL = 900

export function SolverPage() {
  const cube = useAppStore((s) => s.cube)
  const moves = useAppStore((s) => s.solution)
  const step = useAppStore((s) => s.solutionStep)
  const setStep = useAppStore((s) => s.setSolutionStep)
  const setRoute = useAppStore((s) => s.setRoute)

  const [playing, setPlaying] = useState(false)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) return
    if (step >= moves.length) {
      setPlaying(false)
      return
    }
    if (animating) return
    timerRef.current = window.setTimeout(() => setAnimating(true), STEP_INTERVAL)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [playing, step, moves.length, animating])

  function handleAnimationEnd() {
    setAnimating(false)
    setStep(step + 1)
  }

  function next() {
    if (animating || step >= moves.length) return
    setAnimating(true)
  }

  function prev() {
    if (animating || step === 0) return
    setStep(step - 1)
  }

  function restart() {
    setPlaying(false)
    setAnimating(false)
    setStep(0)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-4">
      <header className="mb-3 flex items-center justify-between">
        <Button variant="ghost" className="px-3 py-2 text-sm" onClick={() => setRoute('scanner')}>
          ← Voltar
        </Button>
        <h1 className="text-lg font-semibold">Solução</h1>
        <Button variant="ghost" className="px-3 py-2 text-sm" onClick={() => setRoute('home')}>
          Início
        </Button>
      </header>

      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-950">
        <Cube3D
          state={cube}
          moves={moves}
          playStep={step}
          animating={animating}
          onAnimationEnd={handleAnimationEnd}
        />
      </div>

      <div className="mt-4 flex-1">
        <SolutionControls
          moves={moves}
          step={step}
          playing={playing}
          onPrev={prev}
          onNext={next}
          onTogglePlay={() => setPlaying((p) => !p)}
          onRestart={restart}
        />
      </div>
    </div>
  )
}
