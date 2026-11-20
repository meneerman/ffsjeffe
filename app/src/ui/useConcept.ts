import { useEffect, useMemo, useState } from 'react'
import { zaadVoor } from '../core/menu'
import type { Gerecht, Menu } from '../core/types'
import { stelVoor } from '../core/voorstel'
import { lees, schrijf } from './opslag'
import type { AppData } from './useData'

const SLEUTEL = 'ffsjeffe.concept'
type Concept = { gerechten: Gerecht[]; sinds: string }

/**
 * Het menu zoals het op dit toestel wordt bewerkt, tot vastzetten.
 * Volgorde: geldig lokaal concept → vastgezet niet-leeg menu → voorstel van 3.
 * Een concept vervalt als iemand daarna (opnieuw) vastzette.
 */
export function useConcept(data: AppData, menu: Menu | null) {
  const [concept, setConcept] = useState<Concept | null>(() => lees<Concept>(SLEUTEL))
  const geldig = concept && Array.isArray(concept.gerechten) && !(menu && Date.parse(menu.vastgezetOp) >= Date.parse(concept.sinds)) ? concept : null

  useEffect(() => {
    if (concept && !geldig) {
      schrijf(SLEUTEL, null)
      setConcept(null)
    }
  }, [concept, geldig])

  const { recepten, verpakkingen, instellingen } = data
  const perId = useMemo(() => new Set(recepten.map((r) => r.id)), [recepten])
  const basis = useMemo(
    () => menu && menu.gerechten.length > 0
      ? menu.gerechten
      : stelVoor(recepten, menu?.laatstGegeten ?? {}, verpakkingen, instellingen.huishouden, zaadVoor(menu), new Date()),
    [menu, recepten, verpakkingen, instellingen.huishouden],
  )

  return {
    gerechten: (geldig?.gerechten ?? basis).filter((g) => perId.has(g.receptId)),
    heeftConcept: geldig !== null,
    wijzig(gerechten: Gerecht[]) {
      const c = { gerechten, sinds: new Date().toISOString() }
      schrijf(SLEUTEL, c)
      setConcept(c)
    },
    wis() {
      schrijf(SLEUTEL, null)
      setConcept(null)
    },
  }
}
