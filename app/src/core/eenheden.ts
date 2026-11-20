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
}

/** Zet een hoeveelheid om naar de basiseenheid (g, ml, stuk). Onbekende eenheden blijven zichzelf. */
export function normaliseer(hoeveelheid: number, eenheid: string | null): { hoeveelheid: number; eenheid: string } {
  const e = (eenheid ?? 'stuk').trim().toLowerCase()
  const [factor, basis] = OMREKENING[e] ?? [1, e]
  return { hoeveelheid: hoeveelheid * factor, eenheid: basis }
}

/** Haalt floating-point-ruis weg vóór afronden (0.1*3*1000 = 300.00000000000006). */
export function zuiver(x: number): number {
  return Math.round(x * 1e6) / 1e6
}
