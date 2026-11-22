import type { Recept } from './types'

/** Kleine letters, zonder accenten: "Crème" en "creme" zijn hetzelfde. */
const schoon = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Wat je intikt wordt los gezocht: gescheiden door spaties of komma's. */
function termen(zoek: string): string[] {
  return schoon(zoek).split(/[\s,;]+/).filter(Boolean)
}

/** Meervoud dat je intikt ("uien", "wortels") als enkelvoud, om dat aan het begin van een woord te vinden. */
function stam(t: string): string | null {
  if (t.length > 3 && t.endsWith('en')) return t.slice(0, -2)
  if (t.length > 3 && t.endsWith('s')) return t.slice(0, -1)
  return null
}

function past(tekst: string, term: string): boolean {
  if (tekst.includes(term)) return true
  const s = stam(term)
  return s !== null && tekst.split(/[\s,()/-]+/).some((w) => w.startsWith(s))
}

export type Treffer = { recept: Recept; treffers: string[] }

/**
 * Recepten waarin elk ingrediënt uit `zoek` voorkomt (in een ingrediënt of in de titel).
 * null bij een lege zoekterm: dan is er niets gefilterd. `treffers` zijn de ingrediënten die gevonden zijn.
 */
export function zoekRecepten(recepten: Recept[], zoek: string): Treffer[] | null {
  const ts = termen(zoek)
  if (ts.length === 0) return null
  const uit: Treffer[] = []
  for (const r of recepten) {
    const titel = schoon(r.titel)
    const namen = r.ingredienten.map((i) => ({ naam: i.naam, s: schoon(i.naam) }))
    if (!ts.every((t) => past(titel, t) || namen.some((n) => past(n.s, t)))) continue
    const gevonden = new Set<string>()
    for (const t of ts) for (const n of namen) if (past(n.s, t)) gevonden.add(n.naam)
    uit.push({ recept: r, treffers: [...gevonden] })
  }
  return uit
}
