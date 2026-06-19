export type CubeColor = 'white' | 'yellow' | 'red' | 'orange' | 'blue' | 'green'

export type FaceName = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'

export const FACE_ORDER: FaceName[] = ['U', 'R', 'F', 'D', 'L', 'B']

export const FACE_LABELS: Record<FaceName, string> = {
  U: 'Superior',
  R: 'Direita',
  F: 'Frente',
  D: 'Inferior',
  L: 'Esquerda',
  B: 'Traseira',
}

export const SCAN_ORDER: FaceName[] = ['F', 'R', 'B', 'L', 'U', 'D']

export const SCAN_INSTRUCTIONS: Record<FaceName, string> = {
  F: 'Posicione a face com o centro VERDE em direção à câmera.',
  R: 'Gire o cubo para mostrar o centro VERMELHO.',
  B: 'Gire para mostrar o centro AZUL.',
  L: 'Gire para mostrar o centro LARANJA.',
  U: 'Aponte a face BRANCA para cima.',
  D: 'Aponte a face AMARELA para baixo.',
}

/** A scanned face: 9 colors in reading order (top-left → bottom-right). */
export type Facelets = [
  CubeColor, CubeColor, CubeColor,
  CubeColor, CubeColor, CubeColor,
  CubeColor, CubeColor, CubeColor,
]

export interface ScannedFace {
  face: FaceName
  facelets: Facelets
  /** Average HSV of each cell — used for centre-based calibration. */
  hsv: Array<{ h: number; s: number; v: number }>
}

export interface QualityReport {
  brightness: number
  sharpness: number
  reflection: number
  alignment: number
  ok: boolean
  issues: string[]
}

export interface CubeState {
  /** 6 faces of 9 facelets each, indexed by FaceName. */
  faces: Partial<Record<FaceName, ScannedFace>>
}

export type MoveAxis = 'x' | 'y' | 'z'

export interface Move {
  /** Face character (U/D/L/R/F/B). */
  face: FaceName
  /** +1 = clockwise 90°, -1 = counter-clockwise 90°, +2 = 180°. */
  turns: 1 | -1 | 2
  /** Original notation token (e.g. "R'", "U2"). */
  raw: string
}

export const HEX_FOR_COLOR: Record<CubeColor, string> = {
  white: '#f8fafc',
  yellow: '#facc15',
  red: '#ef4444',
  orange: '#f97316',
  blue: '#3b82f6',
  green: '#22c55e',
}
