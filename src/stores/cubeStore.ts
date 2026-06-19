import { create } from 'zustand'
import type { CubeColor, CubeState, FaceName, Facelets, Move, ScannedFace } from '@/types/cube'
import { SCAN_ORDER } from '@/types/cube'
import type { CalibrationProfile } from '@/services/colorDetection/colorClassifier'

export type AppRoute = 'home' | 'scanner' | 'solver' | 'how'

interface AppState {
  route: AppRoute
  cube: CubeState
  scanIndex: number
  calibration: CalibrationProfile
  solution: Move[]
  solutionStep: number
  solverError: string | null

  setRoute: (r: AppRoute) => void
  reset: () => void

  setFace: (face: FaceName, scanned: ScannedFace) => void
  recolorCell: (face: FaceName, cellIndex: number, color: CubeColor) => void
  removeFace: (face: FaceName) => void
  setScanIndex: (i: number) => void
  advanceScan: () => void

  setCalibration: (c: CalibrationProfile) => void

  setSolution: (moves: Move[]) => void
  setSolutionStep: (i: number) => void
  setSolverError: (msg: string | null) => void
}

const emptyCube = (): CubeState => ({ faces: {} })

export const useAppStore = create<AppState>((set, get) => ({
  route: 'home',
  cube: emptyCube(),
  scanIndex: 0,
  calibration: { centers: {} },
  solution: [],
  solutionStep: 0,
  solverError: null,

  setRoute: (route) => set({ route }),

  reset: () =>
    set({
      route: 'home',
      cube: emptyCube(),
      scanIndex: 0,
      calibration: { centers: {} },
      solution: [],
      solutionStep: 0,
      solverError: null,
    }),

  setFace: (face, scanned) =>
    set((s) => {
      const faces = { ...s.cube.faces, [face]: scanned }
      // Remember the centre colour for future calibration.
      const calibration: CalibrationProfile = {
        centers: {
          ...s.calibration.centers,
          [scanned.facelets[4]]: scanned.hsv[4],
        },
      }
      return { cube: { faces }, calibration }
    }),

  recolorCell: (face, cellIndex, color) =>
    set((s) => {
      const f = s.cube.faces[face]
      if (!f) return s
      const facelets = [...f.facelets] as Facelets
      facelets[cellIndex] = color
      const next: ScannedFace = { ...f, facelets }
      return { cube: { faces: { ...s.cube.faces, [face]: next } } }
    }),

  removeFace: (face) =>
    set((s) => {
      const faces = { ...s.cube.faces }
      delete faces[face]
      return { cube: { faces } }
    }),

  setScanIndex: (scanIndex) => set({ scanIndex }),

  advanceScan: () => {
    const { scanIndex } = get()
    const next = Math.min(SCAN_ORDER.length, scanIndex + 1)
    set({ scanIndex: next })
  },

  setCalibration: (calibration) => set({ calibration }),

  setSolution: (solution) => set({ solution, solutionStep: 0 }),
  setSolutionStep: (solutionStep) => set({ solutionStep }),
  setSolverError: (solverError) => set({ solverError }),
}))
