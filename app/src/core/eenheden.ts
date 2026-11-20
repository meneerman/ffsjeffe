const OMREKENING: Record<string, [number, string]> = {
  kg: [1000, 'g'],
  g: [1, 'g'],
  l: [1000, 'ml'],
  dl: [100, 'ml'],
  cl: [10, 'ml'],
  ml: [1, 'ml'],
  el: [15, 'ml'],
  tl: [5, 'ml'],
  stuk: [1, 'stuk'],
  teentje: [1, 'teen'],
  snufje: [1, 'snuf'],
}

/** Vaste lijst uit de spec: omrekenbaar + vast. Alleen deze woorden gelden als eenheid in een regel. */
export const EENHEDEN = ['g', 'kg', 'ml', 'l', 'dl', 'cl', 'el', 'tl', 'teen', 'teentje', 'bosje', 'takje', 'snuf', 'snufje', 'blik', 'pak', 'zakje', 'plak', 'stuk'] as const

const BREUKTEKENS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 }

/** "2", "0,5", "1.5", "1/2", "½" → getal; anders null. */
export function parseHoeveelheid(s: string): number | null {
  const t = s.trim()
  if (t in BREUKTEKENS) return BREUKTEKENS[t]
  const breuk = /^(\d+)\/(\d+)$/.exec(t)
  if (breuk) return Number(breuk[2]) === 0 ? null : Number(breuk[1]) / Number(breuk[2])
  if (!/^\d+([.,]\d+)?$/.test(t)) return null
  return Number(t.replace(',', '.'))
}

/** Zet een hoeveelheid om naar de basiseenheid (g, ml, stuk, …). Onbekende eenheden blijven zichzelf. */
export function normaliseer(hoeveelheid: number, eenheid: string | null): { hoeveelheid: number; eenheid: string } {
  const e = (eenheid ?? 'stuk').trim().toLowerCase()
  const [factor, basis] = OMREKENING[e] ?? [1, e]
  return { hoeveelheid: hoeveelheid * factor, eenheid: basis }
}

/** Haalt floating-point-ruis weg vóór afronden (0.1*3*1000 = 300.00000000000006). */
export function zuiver(x: number): number {
  return Math.round(x * 1e6) / 1e6
}
