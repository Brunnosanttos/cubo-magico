import { useEffect, useState } from 'react'
import { isSolverReady, onSolverReady } from '@/services/cubeSolver/cubeSolver'

/** Returns true once the solver's pruning table is finished building. */
export function useSolverReady(): boolean {
  const [ready, setReady] = useState(() => isSolverReady())
  useEffect(() => {
    if (isSolverReady()) {
      setReady(true)
      return
    }
    return onSolverReady(setReady)
  }, [])
  return ready
}
