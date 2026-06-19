import { useEffect, useRef, useState } from 'react'
import {
  classifyFace,
  sampleGrid,
  type CellSample,
  type CalibrationProfile,
} from '@/services/colorDetection/colorClassifier'
import { evaluateQuality } from '@/services/colorDetection/qualityCheck'
import type { CubeColor, QualityReport } from '@/types/cube'

export interface DetectionState {
  cells: CellSample[]
  colors: CubeColor[]
  quality: QualityReport | null
}

/**
 * Continuously sample the current video frame, classify the 9 stickers and
 * report a quality score.
 *
 * The video is sampled at ~10 Hz to keep mobile CPUs cool — colour detection
 * doesn't need to run every animation frame.
 */
export function useColorDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  enabled: boolean,
  calibration: CalibrationProfile,
  gridFraction = 0.7,
): DetectionState {
  const [state, setState] = useState<DetectionState>({
    cells: [],
    colors: [],
    quality: null,
  })
  const rafRef = useRef<number | null>(null)
  const lastRunRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    function tick(time: number) {
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      if (time - lastRunRef.current < 100) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      lastRunRef.current = time

      const W = video.videoWidth
      const H = video.videoHeight
      if (!W || !H) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const size = Math.min(W, H) * gridFraction
      const gridBox = { x: (W - size) / 2, y: (H - size) / 2, size }

      try {
        const cells = sampleGrid(video, gridBox)
        const colors = classifyFace(cells, calibration)
        const quality = evaluateQuality({ source: video, gridBox, cells })
        setState({ cells, colors, quality })
      } catch {
        // Swallow transient drawImage failures (video not yet decoded etc.)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [videoRef, enabled, calibration, gridFraction])

  return state
}
