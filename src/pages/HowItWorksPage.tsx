import { Button } from '@/components/Button'
import { useAppStore } from '@/stores/cubeStore'

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: '1. Escaneie as 6 faces',
    body: 'Aponte a câmera traseira para cada face, mantendo o cubo dentro da grade. A captura é automática quando a iluminação, o foco e o enquadramento estão bons.',
  },
  {
    title: '2. Detecção de cores',
    body: 'Cada adesivo é amostrado em sua região central, convertido para HSV e classificado entre branco, amarelo, vermelho, laranja, azul e verde. As peças centrais são usadas como referência para calibrar as demais.',
  },
  {
    title: '3. Validação',
    body: 'Antes de resolver, verificamos se há 54 adesivos, 9 de cada cor e centros distintos. Se algo parecer inconsistente, indicamos quais faces revisar.',
  },
  {
    title: '4. Solução animada',
    body: 'A biblioteca cubejs gera a sequência ideal de movimentos. Um cubo 3D em Three.js executa cada giro, destacando a face e mostrando a instrução textual.',
  },
  {
    title: 'Privacidade',
    body: 'Tudo acontece no seu dispositivo. Nenhuma imagem é enviada para servidores e o aplicativo funciona offline após o primeiro carregamento.',
  },
]

export function HowItWorksPage() {
  const setRoute = useAppStore((s) => s.setRoute)
  return (
    <div className="mx-auto min-h-dvh max-w-md px-6 py-8">
      <h1 className="text-2xl font-bold">Como Funciona</h1>
      <p className="mt-1 text-sm text-slate-400">
        Um scanner de cubo mágico totalmente no navegador.
      </p>

      <div className="mt-6 space-y-4">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-2xl bg-slate-800/70 p-4">
            <div className="font-semibold">{s.title}</div>
            <p className="mt-1 text-sm text-slate-300">{s.body}</p>
          </div>
        ))}
      </div>

      <Button variant="ghost" className="mt-6 w-full" onClick={() => setRoute('home')}>
        Voltar
      </Button>
    </div>
  )
}
