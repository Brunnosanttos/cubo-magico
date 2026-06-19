/**
 * Camera service — thin wrapper around getUserMedia for the rear-facing camera.
 *
 * Kept stateless: callers are responsible for binding the returned MediaStream
 * to a <video> element and for calling stop() when done.
 */

export interface CameraOptions {
  width?: number
  height?: number
}

export async function openRearCamera(opts: CameraOptions = {}): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Câmera não suportada neste navegador.')
  }

  const constraints: MediaStreamConstraints = {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: opts.width ?? 1280 },
      height: { ideal: opts.height ?? 720 },
    },
  }

  return navigator.mediaDevices.getUserMedia(constraints)
}

export function stopStream(stream: MediaStream | null) {
  if (!stream) return
  for (const t of stream.getTracks()) t.stop()
}
