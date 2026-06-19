import type { CubeColor, Facelets } from '@/types/cube'
import { hueDistance, mean, rgbToHsv } from '@/utils/colorSpace'

/**
 * Colour detection — samples the centre of each sticker, converts to HSV,
 * and classifies into one of six cube colours.
 *
 * No neural net, no third-party model — just classical thresholds with an
 * optional centre-based calibration step.
 */

export interface CellSample {
  /** Average HSV across the central pixels of the sticker. */
  h: number
  s: number
  v: number
  /** Stddev of the V channel — proxy for sticker uniformity. */
  vStd: number
}

export interface CalibrationProfile {
  /** Median HSV per known centre colour (collected from previously scanned faces). */
  centers: Partial<Record<CubeColor, { h: number; s: number; v: number }>>
}

/** Reference HSV anchors used when no calibration data exists yet. */
const DEFAULT_ANCHORS: Record<CubeColor, { h: number; s: number; v: number }> = {
  white: { h: 0, s: 0.05, v: 0.92 },
  yellow: { h: 55, s: 0.7, v: 0.9 },
  orange: { h: 20, s: 0.85, v: 0.85 },
  red: { h: 358, s: 0.85, v: 0.75 },
  green: { h: 135, s: 0.7, v: 0.65 },
  blue: { h: 215, s: 0.8, v: 0.6 },
}

/**
 * Read a 3x3 grid of HSV samples from a video frame.
 *
 * The video is drawn into an offscreen canvas, then a small square at the
 * centre of every sticker is sampled. Reading only the centre avoids edges and
 * gaps between stickers.
 */
export function sampleGrid(
  source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
  gridBox: { x: number; y: number; size: number },
): CellSample[] {
  const canvas = document.createElement('canvas')
  const W = (source as any).videoWidth ?? (source as any).width
  const H = (source as any).videoHeight ?? (source as any).height
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(source as CanvasImageSource, 0, 0, W, H)

  const cellSize = gridBox.size / 3
  // Sample the central ~40 % of each sticker — wide enough to average out
  // noise, narrow enough to ignore the rounded sticker edge.
  const sampleHalf = cellSize * 0.2

  const out: CellSample[] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = gridBox.x + cellSize * (col + 0.5)
      const cy = gridBox.y + cellSize * (row + 0.5)
      const x0 = Math.max(0, Math.floor(cx - sampleHalf))
      const y0 = Math.max(0, Math.floor(cy - sampleHalf))
      const w = Math.min(W - x0, Math.ceil(sampleHalf * 2))
      const h = Math.min(H - y0, Math.ceil(sampleHalf * 2))
      const data = ctx.getImageData(x0, y0, w, h).data
      const hs: number[] = []
      const ss: number[] = []
      const vs: number[] = []
      for (let i = 0; i < data.length; i += 4) {
        const { h: hh, s, v } = rgbToHsv(data[i], data[i + 1], data[i + 2])
        hs.push(hh)
        ss.push(s)
        vs.push(v)
      }
      const v = mean(vs)
      const vStd = Math.sqrt(mean(vs.map((x) => (x - v) * (x - v))))
      out.push({ h: circularMeanHue(hs), s: mean(ss), v, vStd })
    }
  }
  return out
}

/** Circular mean of hue values (degrees). */
function circularMeanHue(hs: number[]): number {
  if (!hs.length) return 0
  let x = 0
  let y = 0
  for (const h of hs) {
    const r = (h * Math.PI) / 180
    x += Math.cos(r)
    y += Math.sin(r)
  }
  const a = (Math.atan2(y / hs.length, x / hs.length) * 180) / Math.PI
  return a < 0 ? a + 360 : a
}

/** Build a calibration profile from a list of known centre samples. */
export function buildCalibration(samples: Array<{ color: CubeColor; sample: CellSample }>): CalibrationProfile {
  const centers: CalibrationProfile['centers'] = {}
  for (const { color, sample } of samples) {
    centers[color] = { h: sample.h, s: sample.s, v: sample.v }
  }
  return { centers }
}

/**
 * Classify one sample into a cube colour using HSV thresholds.
 *
 * Strategy:
 *   1. Low saturation + high value → white.
 *   2. Otherwise compare against six anchor colours (calibration first,
 *      defaults as fallback) and pick the nearest in (H, S, V) space, with
 *      heavier weight on hue.
 */
export function classifyColor(sample: CellSample, calibration?: CalibrationProfile): CubeColor {
  // White is easiest — desaturated, bright.
  if (sample.s < 0.22 && sample.v > 0.55) return 'white'

  const anchors: Record<CubeColor, { h: number; s: number; v: number }> = { ...DEFAULT_ANCHORS }
  if (calibration) {
    for (const [color, hsv] of Object.entries(calibration.centers)) {
      if (hsv) anchors[color as CubeColor] = hsv
    }
  }

  let best: CubeColor = 'white'
  let bestScore = Infinity
  for (const [name, anchor] of Object.entries(anchors)) {
    const dh = hueDistance(sample.h, anchor.h) / 180 // 0..1
    const ds = Math.abs(sample.s - anchor.s)
    const dv = Math.abs(sample.v - anchor.v)
    // Hue dominates for the chromatic colours.
    const score = dh * 3 + ds * 0.5 + dv * 0.5
    if (score < bestScore) {
      bestScore = score
      best = name as CubeColor
    }
  }
  return best
}

/** Classify all 9 cells. */
export function classifyFace(samples: CellSample[], calibration?: CalibrationProfile): Facelets {
  const colors = samples.map((s) => classifyColor(s, calibration)) as CubeColor[]
  return colors as Facelets
}
