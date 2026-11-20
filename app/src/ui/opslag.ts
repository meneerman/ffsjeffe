import type { Verbinding } from '../data/github'

export type Opgeslagen = Verbinding & { naam: string }
const SLEUTEL = 'ffsjeffe.verbinding'

/** localStorage kan ontbreken of gooien (privévenster); dan gewoon niets onthouden. */
export function lees<T>(sleutel: string): T | null {
  try {
    const s = localStorage.getItem(sleutel)
    return s ? (JSON.parse(s) as T) : null
  } catch {
    return null
  }
}
export function schrijf(sleutel: string, waarde: unknown): void {
  try {
    if (waarde === null) localStorage.removeItem(sleutel)
    else localStorage.setItem(sleutel, JSON.stringify(waarde))
  } catch {
    /* niets */
  }
}

export function leesVerbinding(): Opgeslagen | null {
  const v = lees<Opgeslagen>(SLEUTEL)
  return v && typeof v.token === 'string' && v.token && typeof v.naam === 'string' ? v : null
}
export const bewaarVerbinding = (v: Opgeslagen) => schrijf(SLEUTEL, v)
