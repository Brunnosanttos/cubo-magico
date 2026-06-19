import type { QualityReport } from '@/types/cube'
import type { CellSample } from './colorClassifier'
import { isOpenCVReady } from './opencvLoader'

/**
 * Real-time quality checks for a captured frame.
 *
 *   - brightness  : average V across the grid (need > 0.35)
 *   - sharpness   : Laplacian variance via OpenCV when available;
 *                   otherwise a Sobel-like estimate over the centre
 *   - reflection  : count of nearly-pure-white-bright cells when the centre
 *                   colour is not white — indicates glare
 *   - alignment   : variance of V across cells — a well-framed face has
 *                   relatively uniform per-cell luminance
 */

export interface QualityInput {
  /** A snapshot of the current video frame (the same one used for sampling). */
  source: HTMLVideoElement
  /** Pixel-space box of the 3x3 grid overlay. */
  gridBox: { x: number; y: number; size: number }
  /** Latest cell samples for the grid. */
  cells: CellSample[]
}

export function evaluateQuality(input: QualityInput): QualityReport {
  const issues: string[] = []
  const { cells } = input

  const brightness = avg(cells.map((c) => c.v))
  if (brightness < 0.35) issues.push('Pouca iluminação. Vá para um local mais iluminado.')

  const sharpness = computeSharpness(input)
  if (sharpness < 0.25) issues.push('Imagem desfocada. Segure o celular mais firme.')

  const reflection = computeReflectionScore(cells)
  if (reflection > 0.35) issues.push('Reflexo detectado. Incline o cubo e tente novamente.')

  const alignment = computeAlignment(cells)
  if (alignment < 0.5) issues.push('Centralize a face do cubo dentro da grade.')

  return {
    brightness,
    sharpness,
    reflection,
    alignment,
    ok: issues.length === 0,
    issues,
  }
}

function avg(xs: number[]): number {
  if (!xs.length) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/**
 * Sharpness via Laplacian variance (OpenCV) when ready, otherwise a quick
 * pure-TS estimate based on cell luminance variance.
 */
function computeSharpness({ source, gridBox }: QualityInput): number {
  if (isOpenCVReady() && window.cv) {
    return cvLaplacian(source, gridBox)
  }
  // Without OpenCV we estimate "edge energy" from the source pixels around the
  // grid centre. It is coarser but good enough as a fallback.
  return naiveSharpness(source, gridBox)
}

function cvLaplacian(source: HTMLVideoElement, gridBox: QualityInput['gridBox']): number {
  const cv = window.cv as any
  const canvas = document.createElement('canvas')
  canvas.width = gridBox.size
  canvas.height = gridBox.size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    source,
    gridBox.x,
    gridBox.y,
    gridBox.size,
    gridBox.size,
    0,
    0,
    gridBox.size,
    gridBox.size,
  )
  const src = cv.imread(canvas)
  const gray = new cv.Mat()
  const lap = new cv.Mat()
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
  cv.Laplacian(gray, lap, cv.CV_64F)
  const meanStd = new cv.Mat()
  const mean = new cv.Mat()
  cv.meanStdDev(lap, mean, meanStd)
  const std = (meanStd.data64F as Float64Array)[0]
  src.delete()
  gray.delete()
  lap.delete()
  meanStd.delete()
  mean.delete()
  // Normalise into a 0..1 score; ~80 is the textbook "sharp" threshold for
  // 8-bit images, so we map roughly that range.
  return Math.min(1, (std * std) / 600)
}

function naiveSharpness(source: HTMLVideoElement, gridBox: QualityInput['gridBox']): number {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    source,
    gridBox.x,
    gridBox.y,
    gridBox.size,
    gridBox.size,
    0,
    0,
    size,
    size,
  )
  const { data } = ctx.getImageData(0, 0, size, size)
  let energy = 0
  let count = 0
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = (y * size + x) * 4
      const c = lum(data, i)
      const r = lum(data, i + 4)
      const d = lum(data, i + size * 4)
      energy += Math.abs(c - r) + Math.abs(c - d)
      count++
    }
  }
  const e = energy / (count || 1)
  return Math.min(1, e / 35)
}

function lum(data: Uint8ClampedArray, i: number): number {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
}

function computeReflectionScore(cells: CellSample[]): number {
  // A reflection is a bright, low-saturation, low-variance hotspot — but a
  // truly white sticker is *also* bright and desaturated. We only flag a cell
  // as glare when its V is unusually high relative to the other cells.
  const vs = cells.map((c) => c.v)
  const maxV = Math.max(...vs)
  if (maxV < 0.85) return 0
  let glare = 0
  for (const c of cells) {
    if (c.v > 0.92 && c.s < 0.15 && c.vStd > 0.06) glare++
  }
  return glare / cells.length
}

function computeAlignment(cells: CellSample[]): number {
  // Loose proxy: if cells are wildly different in V the camera is probably
  // catching the cube's edges/background. A uniform face has lower variance.
  const vs = cells.map((c) => c.v)
  const m = avg(vs)
  const variance = avg(vs.map((v) => (v - m) * (v - m)))
  return Math.max(0, 1 - variance * 6)
}
