import { useEffect, useRef, useState } from 'react'
import { openRearCamera, stopStream } from '@/services/camera/cameraService'

/**
 * Bind a MediaStream to a <video> ref. The hook owns the lifecycle: it opens
 * the camera on mount, stops the stream on unmount, and surfaces any error.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await openRearCamera()
        if (cancelled) {
          stopStream(stream)
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          video.setAttribute('playsinline', 'true')
          await video.play().catch(() => undefined)
          setReady(true)
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Falha ao iniciar a câmera.')
      }
    }

    start()

    return () => {
      cancelled = true
      stopStream(streamRef.current)
      streamRef.current = null
      setReady(false)
    }
  }, [])

  return { videoRef, ready, error }
}
