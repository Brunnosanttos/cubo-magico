import { Button } from '@/components/Button'
import { useAppStore } from '@/stores/cubeStore'

export function HomePage() {
  const setRoute = useAppStore((s) => s.setRoute)
  const reset = useAppStore((s) => s.reset)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between px-6 py-10">
      <div className="mt-12 text-center">
        <div className="mx-auto mb-6 grid h-20 w-20 grid-cols-3 grid-rows-3 gap-1 rounded-2xl bg-slate-800 p-2">
          {['#f8fafc','#ef4444','#22c55e','#facc15','#3b82f6','#f97316','#22c55e','#f8fafc','#facc15'].map((c,i)=>(
            <div key={i} className="rounded" style={{ background: c }} />
          ))}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Cubo Mágico Solver</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-400">
          Aponte a câmera para cada face, deixe a captura automática trabalhar e veja a solução
          animada em 3D — tudo offline, direto no seu navegador.
        </p>
      </div>

      <div className="mb-6 w-full max-w-sm space-y-3">
        <Button
          className="w-full"
          onClick={() => {
            reset()
            setRoute('scanner')
          }}
        >
          📷 Escanear Cubo
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => setRoute('how')}>
          Como Funciona
        </Button>
      </div>
    </div>
  )
}
