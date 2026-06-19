/**
 * Lazy OpenCV.js loader.
 *
 * Loads the WASM build once on demand. We use it only for sharpness (Laplacian
 * variance) — colour classification is done in plain TS so the app can keep
 * working even if OpenCV fails to load (e.g. blocked CDN).
 */

const OPENCV_URL = 'https://docs.opencv.org/4.10.0/opencv.js'

let loader: Promise<any> | null = null

export function loadOpenCV(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('OpenCV requires a browser environment.'))
  }
  if (window.cv && (window.cv as any).Mat) return Promise.resolve(window.cv)
  if (loader) return loader

  loader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-opencv]')
    const ready = () => {
      const cv = window.cv
      if (!cv) return reject(new Error('OpenCV não carregou.'))
      // OpenCV 4.x exposes onRuntimeInitialized via the Module proxy.
      if (cv.Mat) return resolve(cv)
      cv.onRuntimeInitialized = () => resolve(cv)
    }
    if (existing) {
      ready()
      return
    }
    const s = document.createElement('script')
    s.async = true
    s.src = OPENCV_URL
    s.dataset.opencv = '1'
    s.onload = ready
    s.onerror = () => reject(new Error('Falha ao baixar OpenCV.'))
    document.head.appendChild(s)
  })
  return loader
}

export function isOpenCVReady(): boolean {
  return !!(typeof window !== 'undefined' && window.cv && (window.cv as any).Mat)
}
