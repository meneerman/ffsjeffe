import { normaliseer, zuiver } from './eenheden'
import { sleutel } from './recepten'
import type { Gerecht, Recept, Verpakkingen } from './types'

/** Opgeteld over het menu, in basiseenheid. hoeveelheid null = naar smaak. */
export type Behoefte = { naam: string; hoeveelheid: number | null; eenheid: string | null }

export function schaalfactor(recept: Recept, eters: number, avonden: number): number {
  return (eters * avonden) / recept.porties
}

export function behoeften(gerechten: Gerecht[], recepten: Record<string, Recept>): Behoefte[] {
  const totaal = new Map<string, Behoefte>()
  for (const g of gerechten) {
    const r = recepten[g.receptId]
    if (!r) continue
    const factor = schaalfactor(r, g.eters, g.avonden)
    for (const i of r.ingredienten) {
      const naam = sleutel(i.naam)
      if (i.hoeveelheid === null) {
        const k = `${naam}|`
        if (!totaal.has(k)) totaal.set(k, { naam, hoeveelheid: null, eenheid: null })
        continue
      }
      const n = normaliseer(i.hoeveelheid * factor, i.eenheid)
      const k = `${naam}|${n.eenheid}`
      const bestaand = totaal.get(k)
      if (bestaand) bestaand.hoeveelheid = zuiver(bestaand.hoeveelheid! + n.hoeveelheid)
      else totaal.set(k, { naam, hoeveelheid: zuiver(n.hoeveelheid), eenheid: n.eenheid })
    }
  }
  return [...totaal.values()]
}

/** Aantal verpakkingen dat nodig is, of null als er geen passende verpakking is. */
export function aantalVerpakkingen(b: Behoefte, verpakkingen: Verpakkingen): number | null {
  const v = verpakkingen[sleutel(b.naam)]
  if (!v || b.hoeveelheid === null || b.eenheid === null) return null
  const maat = normaliseer(v.hoeveelheid, v.eenheid)
  if (maat.eenheid !== b.eenheid) return null
  return Math.ceil(zuiver(b.hoeveelheid / maat.hoeveelheid))
}

const hoofdletter = (s: string) => s.charAt(0).toLocaleUpperCase('nl') + s.slice(1)

export function boodschappenRegels(b: Behoefte[], verpakkingen: Verpakkingen): string[] {
  const regels = b.map((x) => {
    const naam = hoofdletter(x.naam)
    if (x.hoeveelheid === null) return naam
    const n = aantalVerpakkingen(x, verpakkingen)
    if (n !== null) {
      const v = verpakkingen[sleutel(x.naam)]
      return `${naam} ${n}× ${v.hoeveelheid} ${v.eenheid}`
    }
    const h = Math.ceil(zuiver(x.hoeveelheid))
    return x.eenheid === 'stuk' ? `${naam} ${h}` : `${naam} ${h} ${x.eenheid}`
  })
  return regels.sort((a, c) => a.localeCompare(c, 'nl'))
}
