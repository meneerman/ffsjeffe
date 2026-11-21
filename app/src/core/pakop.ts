import { normaliseer, zuiver } from './eenheden'
import { sleutel } from './recepten'
import type { Gerecht, Recept, Verpakkingen } from './types'

const TIP_VANAF = 0.15 // meer dan 15% van een pak over: tip geven
const BIJNA_OP = 0.1 // het voorstel laat hooguit 10% van een pak over
const MATEN = new Set(['g', 'ml'])

export type PakOp = { naam: string; porties: number; eters: number; avonden: number }

/** Deel van één pak dat overblijft als je `nodig` koopt in pakken van `pak`. */
function rest(nodig: number, pak: number): number {
  return zuiver(Math.ceil(zuiver(nodig / pak)) * pak - nodig) / pak
}

/**
 * Tip om het grootste verpakte ingrediënt van een gerecht (bijna) op te maken:
 * een iets groter aantal porties (tot ± anderhalf keer), uitgedrukt in eters en avonden.
 * Null als er weinig overblijft of er binnen bereik geen beter aantal is.
 */
export function pakOp(r: Recept, g: Gerecht, verpakkingen: Verpakkingen): PakOp | null {
  let hoofd: { naam: string; perPortie: number; pak: number } | null = null
  for (const i of r.ingredienten) {
    const v = verpakkingen[sleutel(i.naam)]
    if (i.hoeveelheid === null || !v) continue
    const nodig = normaliseer(i.hoeveelheid, i.eenheid)
    const pak = normaliseer(v.hoeveelheid, v.eenheid)
    if (nodig.eenheid !== pak.eenheid || !MATEN.has(pak.eenheid)) continue
    const perPortie = nodig.hoeveelheid / r.porties
    if (!hoofd || perPortie > hoofd.perPortie) hoofd = { naam: i.naam, perPortie, pak: pak.hoeveelheid }
  }
  if (!hoofd) return null

  const nu = g.eters * g.avonden
  if (rest(nu * hoofd.perPortie, hoofd.pak) <= TIP_VANAF) return null
  for (let p = nu + 1; p <= nu + Math.max(2, Math.floor(nu / 2)); p++) {
    if (rest(p * hoofd.perPortie, hoofd.pak) > BIJNA_OP) continue
    if (p % g.eters === 0) return { naam: hoofd.naam, porties: p, eters: g.eters, avonden: p / g.eters }
    if (p % g.avonden === 0) return { naam: hoofd.naam, porties: p, eters: p / g.avonden, avonden: g.avonden }
  }
  return null
}
