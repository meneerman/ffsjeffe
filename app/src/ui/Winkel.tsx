import type { Winkels } from '../core/winkels'
import { buitenAh, buitenLidl } from '../core/winkels'

const NAAM = { lidl: 'Lidl', ah: 'Albert Heijn' } as const

/** Klein winkelicoon met een streep erdoor: dit is daar niet te koop. */
export function Winkelbord({ winkel, wat }: { winkel: 'lidl' | 'ah'; wat?: string }) {
  const label = wat ? `Niet bij ${NAAM[winkel]}: ${wat}` : `Niet bij ${NAAM[winkel]}`
  return (
    <span className={`winkel winkel-${winkel}`} role="img" aria-label={label} title={label}>
      {winkel === 'lidl' ? 'Lidl' : 'AH'}
    </span>
  )
}

/** De iconen voor één ingrediënt: alleen wat daar niet te koop is. AH-streep komt er alleen bij als ook Lidl hem mist. */
export function Winkelbordjes({ naam, winkels }: { naam: string; winkels: Winkels }) {
  const lidl = buitenLidl(naam, winkels)
  const ah = buitenAh(naam, winkels)
  if (!lidl && !ah) return null
  return (
    <span className="winkelbordjes">
      {lidl && <Winkelbord winkel="lidl" />}
      {ah && <Winkelbord winkel="ah" />}
    </span>
  )
}
