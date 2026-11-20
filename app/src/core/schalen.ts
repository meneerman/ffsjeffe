import { EENHEDEN, parseHoeveelheid } from './eenheden'
import type { Ingredient } from './types'

/** Max 1 decimaal, komma als scheidingsteken: 0,5 · 200 · 1,3 */
export function toonHoeveelheid(h: number): string {
  return (Math.round(h * 10) / 10).toLocaleString('nl-NL', { maximumFractionDigits: 1 })
}

const MAAT = new Set(['g', 'kg', 'ml', 'l', 'dl', 'cl'])
const LEPEL = new Set(['el', 'tl'])

/** Kookvriendelijk: maten ≥ 10 heel, stuks/tenen/bosjes op halven (min ½), lepels op kwarten (min ¼). */
function rond(h: number, eenheid: string | null): number {
  const e = eenheid ?? 'stuk'
  if (MAAT.has(e)) return h >= 10 ? Math.round(h) : h
  if (LEPEL.has(e)) return Math.max(0.25, Math.round(h * 4) / 4)
  return Math.max(0.5, Math.round(h * 2) / 2)
}

function metEenheid(h: number, eenheid: string | null): string {
  const g = rond(h, eenheid)
  const r = LEPEL.has(eenheid ?? '') ? g.toLocaleString('nl-NL', { maximumFractionDigits: 2 }) : toonHoeveelheid(g)
  return eenheid && eenheid !== 'stuk' ? `${r} ${eenheid}` : r
}

export function toonIngredient(i: Ingredient, factor: number): string {
  return i.hoeveelheid === null ? i.naam : `${metEenheid(i.hoeveelheid * factor, i.eenheid)} ${i.naam}`
}

/** Vervangt {400 g} en {2} door de geschaalde waarde; een ongeldige {…} wordt letterlijk getoond. */
export function schaalStap(stap: string, factor: number): string {
  return stap.replace(/\{([^{}]*)\}/g, (_, inhoud: string) => {
    const delen = inhoud.trim().split(/\s+/)
    const h = parseHoeveelheid(delen[0] ?? '')
    const eenheid = delen[1]?.toLowerCase()
    const geldig = h !== null && (delen.length === 1 || (delen.length === 2 && (EENHEDEN as readonly string[]).includes(eenheid!)))
    return geldig ? metEenheid(h * factor, eenheid ?? null) : inhoud
  })
}
