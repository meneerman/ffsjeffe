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
  const kandidaten: number[] = []
  for (let p = nu + 1; p <= nu + Math.max(2, Math.floor(nu / 2)); p++) {
    if (rest(p * hoofd.perPortie, hoofd.pak) <= BIJNA_OP) kandidaten.push(p)
  }
  // liefst dezelfde eters en een avond erbij; anders meer eters bij dezelfde avonden
  const metAvonden = kandidaten.find((p) => p % g.eters === 0)
  if (metAvonden) return { naam: hoofd.naam, porties: metAvonden, eters: g.eters, avonden: metAvonden / g.eters }
  const metEters = kandidaten.find((p) => p % g.avonden === 0)
  if (metEters) return { naam: hoofd.naam, porties: metEters, eters: metEters / g.avonden, avonden: g.avonden }
  return null
}
