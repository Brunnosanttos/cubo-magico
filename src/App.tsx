import { useEffect } from 'react'
import { useAppStore } from '@/stores/cubeStore'
import { HomePage } from '@/pages/HomePage'
import { ScannerPage } from '@/pages/ScannerPage'
import { SolverPage } from '@/pages/SolverPage'
import { HowItWorksPage } from '@/pages/HowItWorksPage'
import { ensureSolverReady } from '@/services/cubeSolver/cubeSolver'

export default function App() {
  const route = useAppStore((s) => s.route)

  // Start warming up the cubejs solver tables as soon as the app mounts so
  // the first solve doesn't block the UI.
  useEffect(() => {
    ensureSolverReady().catch(() => undefined)
  }, [])

  switch (route) {
    case 'scanner':
      return <ScannerPage />
    case 'solver':
      return <SolverPage />
    case 'how':
      return <HowItWorksPage />
    case 'home':
    default:
      return <HomePage />
  }
}
