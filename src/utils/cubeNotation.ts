import type { FaceName, Move } from '@/types/cube'

/** Parse a solver output string like "R U R' U' F2" into structured moves. */
export function parseMoves(solution: string): Move[] {
  const tokens = solution.trim().split(/\s+/).filter(Boolean)
  return tokens.map((raw) => {
    const face = raw[0] as FaceName
    const suffix = raw.slice(1)
    let turns: 1 | -1 | 2 = 1
    if (suffix === "'") turns = -1
    else if (suffix === '2') turns = 2
    return { face, turns, raw }
  })
}

/** Human-readable Portuguese description of a single move. */
export function describeMove(m: Move): string {
  const faceLabel: Record<FaceName, string> = {
    U: 'superior',
    D: 'inferior',
    L: 'esquerda',
    R: 'direita',
    F: 'frontal',
    B: 'traseira',
  }
  const direction =
    m.turns === 2 ? '180°' : m.turns === 1 ? '90° no sentido horário' : '90° no sentido anti-horário'
  return `Gire a face ${faceLabel[m.face]} ${direction}.`
}
