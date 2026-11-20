import { useRef, useState } from 'react'
import type { Recept } from '../core/types'

/** Veegdeck: rechts of "Kies" = erbij, links of "Volgende" = overslaan. */
export function Toevoegen({ opties, kies, sluit, meta }: { opties: Recept[]; kies: (r: Recept) => void; sluit: () => void; meta: (r: Recept) => string }) {
  const [i, setI] = useState(0)
  const [dx, setDx] = useState(0)
  const startX = useRef<number | null>(null)
  const r = opties[i]

  const los = () => {
    if (startX.current === null) return
    startX.current = null
    if (dx > 80 && r) kies(r)
    else if (dx < -80) setI((n) => n + 1)
    setDx(0)
  }

  return (
    <div className="paneel-achtergrond" onClick={sluit}>
      <div className="paneel" role="dialog" aria-label="Gerecht toevoegen" onClick={(e) => e.stopPropagation()}>
        <div className="eyebrow">gerecht erbij</div>
        {r ? (
          <div
            className="deck-kaart"
            style={{ transform: `translateX(${dx}px) rotate(${dx / 30}deg)`, transition: startX.current === null ? 'transform .35s var(--veer)' : 'none' }}
            onPointerDown={(e) => { startX.current = e.clientX }}
            onPointerMove={(e) => { if (startX.current !== null) setDx(e.clientX - startX.current) }}
            onPointerUp={los}
            onPointerCancel={los}
          >
            <h2 className="kop-klein">{r.titel}</h2>
            <p className="zacht">{meta(r)}</p>
            <p className="zacht klein">← overslaan · erbij →</p>
          </div>
        ) : (
          <p className="zacht deck-leeg">Geen andere gerechten meer.</p>
        )}
        <div className="knoppenrij">
          <button className="knop" onClick={sluit}>Sluiten</button>
          {r && <button className="knop" onClick={() => setI((n) => n + 1)}>Volgende</button>}
          {r && <button className="knop accent" onClick={() => kies(r)}>Kies</button>}
        </div>
      </div>
    </div>
  )
}
