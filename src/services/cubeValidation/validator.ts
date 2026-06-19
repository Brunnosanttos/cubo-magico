import type { CubeColor, CubeState, FaceName, ScannedFace } from '@/types/cube'
import { FACE_LABELS, FACE_ORDER } from '@/types/cube'

/**
 * Validate a fully scanned cube and convert it into the 54-character facelet
 * string expected by cubejs.
 *
 * The conversion uses the *centre* sticker of each scanned face to determine
 * which face label (U/R/F/D/L/B) corresponds to which cube colour, so we
 * are agnostic to the user's specific colour-to-face arrangement.
 */

export type ValidationErrorKind =
  | 'missing-faces'
  | 'color-count'
  | 'duplicate-centres'
  | 'impossible-state'

export interface ValidationResult {
  ok: boolean
  facelets?: string
  /** Faces the user should recapture — empty when ok=true. */
  suspectFaces: FaceName[]
  /** Short human-readable summary. */
  message?: string
  /** Optional structured detail (e.g. "verde: 11/9, vermelho: 7/9"). */
  details?: string
  kind?: ValidationErrorKind
}

const ALL_COLORS: CubeColor[] = ['white', 'yellow', 'red', 'orange', 'blue', 'green']

const COLOR_LABELS_PT: Record<CubeColor, string> = {
  white: 'branco',
  yellow: 'amarelo',
  red: 'vermelho',
  orange: 'laranja',
  blue: 'azul',
  green: 'verde',
}

export function validateCube(state: CubeState): ValidationResult {
  const faces = FACE_ORDER.map((f) => state.faces[f]).filter(Boolean) as ScannedFace[]

  if (faces.length !== 6) {
    return {
      ok: false,
      kind: 'missing-faces',
      suspectFaces: FACE_ORDER.filter((f) => !state.faces[f]),
      message: 'Escaneie todas as 6 faces antes de prosseguir.',
    }
  }

  // 1. Exactly 9 of each colour.
  const counts: Record<CubeColor, number> = {
    white: 0, yellow: 0, red: 0, orange: 0, blue: 0, green: 0,
  }
  for (const face of faces) {
    for (const c of face.facelets) counts[c]++
  }

  const wrong = ALL_COLORS.filter((c) => counts[c] !== 9)
  if (wrong.length > 0) {
    return {
      ok: false,
      kind: 'color-count',
      suspectFaces: suspectFacesForWrongCounts(faces, counts),
      message: 'A contagem de cores não bateu. Provavelmente alguma face foi lida errado.',
      details: wrong
        .map((c) => `${COLOR_LABELS_PT[c]}: ${counts[c]}/9`)
        .join(' · '),
    }
  }

  // 2. Centres must be 6 different colours.
  const centerColors = faces.map((f) => f.facelets[4])
  if (new Set(centerColors).size !== 6) {
    const dup = findDuplicateCentre(faces)
    return {
      ok: false,
      kind: 'duplicate-centres',
      suspectFaces: dup,
      message: 'Duas faces estão com a mesma cor central. Recapture essas faces.',
      details: dup
        .map((f) => `${f} (${FACE_LABELS[f]}) · centro ${COLOR_LABELS_PT[state.faces[f]!.facelets[4]]}`)
        .join(' · '),
    }
  }

  // 3. Build facelet string — final physical-validity check is done by the
  //    solver itself (it will throw on impossible corner/edge parities).
  const facelets = buildFaceletString(state)
  if (!facelets) {
    return {
      ok: false,
      kind: 'impossible-state',
      suspectFaces: FACE_ORDER,
      message: 'Não foi possível interpretar o estado do cubo. Recapture as faces.',
    }
  }

  return { ok: true, facelets, suspectFaces: [] }
}

/**
 * Map a solver failure ("cubejs couldn't find a solution") to a
 * ValidationResult so the UI can render it the same way as the static checks.
 */
export function impossibleStateResult(): ValidationResult {
  return {
    ok: false,
    kind: 'impossible-state',
    suspectFaces: [...FACE_ORDER],
    message:
      'As cores capturadas não formam um cubo fisicamente possível. Alguma face foi lida errado.',
    details:
      'Contagem de cores e centros estão corretos, mas as posições dos adesivos não correspondem a nenhum cubo real (paridade de arestas/quinas impossível).',
  }
}

/**
 * Heuristic: faces that contain >3 stickers of an over-represented colour,
 * or whose centre is an under-represented colour, are most likely the
 * misread ones.
 */
function suspectFacesForWrongCounts(
  faces: ScannedFace[],
  counts: Record<CubeColor, number>,
): FaceName[] {
  const suspect = new Set<FaceName>()
  const over = ALL_COLORS.filter((c) => counts[c] > 9)
  const under = ALL_COLORS.filter((c) => counts[c] < 9)

  for (const face of faces) {
    const local: Record<CubeColor, number> = {
      white: 0, yellow: 0, red: 0, orange: 0, blue: 0, green: 0,
    }
    for (const c of face.facelets) local[c]++
    for (const c of over) if (local[c] > 3) suspect.add(face.face)
    for (const c of under) {
      // Centres are fixed — if a face's centre is under-represented globally,
      // that face's other cells are likely mis-detected as something else.
      if (face.facelets[4] === c) suspect.add(face.face)
    }
  }
  return Array.from(suspect)
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
