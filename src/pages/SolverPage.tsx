import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { Cube3D } from '@/components/Cube3D'
import { SolutionControls } from '@/components/SolutionControls'
import { Button } from '@/components/Button'
import { useAppStore } from '@/stores/cubeStore'

class CubeErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('Cube3D crash:', error)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-rose-200">
          Falha ao renderizar o cubo 3D. {this.state.error.message}
        </div>
      )
    }
    return this.props.children
  }
}

const STEP_INTERVAL = 900

export function SolverPage() {
  const cube = useAppStore((s) => s.cube)
  const moves = useAppStore((s) => s.solution)
  const step = useAppStore((s) => s.solutionStep)
  const setStep = useAppStore((s) => s.setSolutionStep)
  const setRoute = useAppStore((s) => s.setRoute)

  const [playing, setPlaying] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [autoRotate, setAutoRotate] = useState(true)
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

      <div
        className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-950"
        style={{ height: 'min(85vw, 420px)' }}
      >
        <CubeErrorBoundary>
          <Cube3D
            state={cube}
            moves={moves}
            playStep={step}
            animating={animating}
            autoRotate={autoRotate}
            onAnimationEnd={handleAnimationEnd}
          />
        </CubeErrorBoundary>

        <button
          onClick={() => setAutoRotate((v) => !v)}
          className="absolute right-3 top-3 rounded-full bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-100 backdrop-blur transition hover:bg-slate-900"
          aria-label={autoRotate ? 'Pausar rotação automática' : 'Retomar rotação automática'}
        >
          {autoRotate ? '⏸ Pausar giro' : '▶ Girar'}
        </button>
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/60 px-3 py-1 text-[10px] uppercase tracking-wide text-slate-300 backdrop-blur">
          arraste para girar
        </div>
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
