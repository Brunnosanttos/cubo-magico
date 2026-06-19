import type { CubeColor, CubeState, FaceName, ScannedFace } from '@/types/cube'
import { FACE_ORDER } from '@/types/cube'

/**
 * Validate a fully scanned cube and convert it into the 54-character facelet
 * string expected by cubejs.
 *
 * The conversion uses the *centre* sticker of each scanned face to determine
 * which face label (U/R/F/D/L/B) corresponds to which cube colour. This makes
 * the scanner agnostic to the user's specific colour-to-face arrangement.
 */

export interface ValidationResult {
  ok: boolean
  facelets?: string
  /** Faces whose colour distribution looks suspicious — recommend rescan. */
  suspectFaces: FaceName[]
  /** Human-readable error message when ok=false. */
  message?: string
}

export function validateCube(state: CubeState): ValidationResult {
  const faces = FACE_ORDER.map((f) => state.faces[f]).filter(Boolean) as ScannedFace[]

  if (faces.length !== 6) {
    return {
      ok: false,
      suspectFaces: FACE_ORDER.filter((f) => !state.faces[f]),
      message: 'Escaneie todas as 6 faces antes de prosseguir.',
    }
  }

  // 1. Total = 54 stickers.
  const counts: Partial<Record<CubeColor, number>> = {}
  for (const face of faces) {
    for (const c of face.facelets) counts[c] = (counts[c] ?? 0) + 1
  }

  const suspect: FaceName[] = []
  for (const color of ['white', 'yellow', 'red', 'orange', 'blue', 'green'] as CubeColor[]) {
    if ((counts[color] ?? 0) !== 9) {
      // Mark faces where this colour appears too often as suspect.
      for (const face of faces) {
        const n = face.facelets.filter((c) => c === color).length
        if (n > 3) suspect.push(face.face)
      }
    }
  }

  if (suspect.length > 0) {
    return {
      ok: false,
      suspectFaces: Array.from(new Set(suspect)),
      message: 'Detectamos uma leitura inconsistente. Vamos revisar algumas faces.',
    }
  }

  // 2. Centres must all be distinct.
  const centerColors = faces.map((f) => f.facelets[4])
  if (new Set(centerColors).size !== 6) {
    const dup = findDuplicateCentre(faces)
    return {
      ok: false,
      suspectFaces: dup,
      message: 'Duas faces parecem ter a mesma cor central. Recapture essas faces.',
    }
  }

  // 3. Build facelet string and let cubejs validate the rest.
  const facelets = buildFaceletString(state)
  if (!facelets) {
    return {
      ok: false,
      suspectFaces: FACE_ORDER,
      message: 'Não foi possível interpretar o estado do cubo. Recapture as faces.',
    }
  }

  return { ok: true, facelets, suspectFaces: [] }
}

function findDuplicateCentre(faces: ScannedFace[]): FaceName[] {
  const byColor = new Map<CubeColor, FaceName[]>()
  for (const f of faces) {
    const c = f.facelets[4]
    if (!byColor.has(c)) byColor.set(c, [])
    byColor.get(c)!.push(f.face)
  }
  const out: FaceName[] = []
  for (const list of byColor.values()) if (list.length > 1) out.push(...list)
  return out
}

/**
 * Build the 54-char facelet string for cubejs.
 *
 * cubejs expects the faces in U R F D L B order, each face read left→right
 * top→bottom. The characters represent face labels (U/R/F/D/L/B) — NOT
 * colours — so we map each scanned colour to whichever face has that colour
 * as its centre.
 */
export function buildFaceletString(state: CubeState): string | null {
  const colorToFace = new Map<CubeColor, FaceName>()
  for (const f of FACE_ORDER) {
    const face = state.faces[f]
    if (!face) return null
    colorToFace.set(face.facelets[4], f)
  }

  let out = ''
  for (const f of FACE_ORDER) {
    const face = state.faces[f]!
    for (const sticker of face.facelets) {
      const label = colorToFace.get(sticker)
      if (!label) return null
      out += label
    }
  }
  return out
}
