import { behoeften, boodschappenRegels } from '../core/boodschappen'
import type { Recept, Slot, Verpakkingen } from '../core/types'

export function Boodschappen({ slots, perId, huishouden, verpakkingen }: { slots: Slot[]; perId: Record<string, Recept>; huishouden: number; verpakkingen: Verpakkingen }) {
  const regels = boodschappenRegels(behoeften(slots, perId, huishouden), verpakkingen)
  if (regels.length === 0) return null
  return (
    <section>
      <h2>Boodschappen</h2>
      <p className="zacht klein">Dit komt bij vastzetten op de Keep-lijst.</p>
      <ul className="kaart boodschappen">
        {regels.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </section>
  )
}
