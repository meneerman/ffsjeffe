import { useEffect, useMemo, useRef, useState } from 'react'
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

  const gerechten = (geldig?.gerechten ?? basis).filter((g) => perId.has(g.receptId))
  const laatste = useRef(gerechten)
  laatste.current = gerechten

  return {
    gerechten,
    heeftConcept: geldig !== null,
    /** Accepteert een lijst of een functie op de nieuwste lijst (veilig vanuit timers). */
    wijzig(nieuw: Gerecht[] | ((huidig: Gerecht[]) => Gerecht[])) {
      const lijst = typeof nieuw === 'function' ? nieuw(laatste.current) : nieuw
      laatste.current = lijst
      const c = { gerechten: lijst, sinds: new Date().toISOString() }
      schrijf(SLEUTEL, c)
      setConcept(c)
    },
    wis() {
      schrijf(SLEUTEL, null)
      setConcept(null)
    },
  }
}
