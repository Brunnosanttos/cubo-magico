import { useEffect, useRef, useState } from 'react'
import type { QualityReport } from '@/types/cube'

/**
 * Watches a stream of QualityReports and triggers `onCapture` once the quality
 * has been "ok" continuously for `holdMs` milliseconds.
 *
 *   - Resets the timer whenever quality drops.
 *   - Returns a `holding` flag and the elapsed ms so the UI can show progress.
 */
export function useStableCapture(
  quality: QualityReport | null,
  onCapture: () => void,
  holdMs = 1000,
) {
  const startedAtRef = useRef<number | null>(null)
  const firedRef = useRef(false)
  const [elapsed, setElapsed] = useState(0)
  const onCaptureRef = useRef(onCapture)

  useEffect(() => {
    onCaptureRef.current = onCapture
  }, [onCapture])

  useEffect(() => {
    if (!quality || !quality.ok) {
      startedAtRef.current = null
      firedRef.current = false
      setElapsed(0)
      return
    }

    if (startedAtRef.current == null) {
      startedAtRef.current = performance.now()
    }

    const interval = window.setInterval(() => {
      if (startedAtRef.current == null) return
      const dt = performance.now() - startedAtRef.current
      setElapsed(dt)
      if (dt >= holdMs && !firedRef.current) {
        firedRef.current = true
        onCaptureRef.current()
      }
    }, 50)

    return () => window.clearInterval(interval)
  }, [quality, holdMs])

  /** Caller can force-reset the timer (e.g. after recording the capture). */
  const reset = () => {
    startedAtRef.current = null
    firedRef.current = false
    setElapsed(0)
  }

  return { holding: !!quality?.ok, elapsed, progress: Math.min(1, elapsed / holdMs), reset }
}
