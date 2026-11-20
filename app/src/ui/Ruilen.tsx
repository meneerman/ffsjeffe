import { useRef, useState } from 'react'
import type { Recept } from '../core/types'

/** Eén kaart tegelijk: naar rechts vegen of "Kies" = kiezen, naar links of "Volgende" = overslaan. */
export function Ruilen({ opties, kies, sluit }: { opties: Recept[]; kies: (r: Recept) => void; sluit: () => void }) {
  const [i, setI] = useState(0)
  const startX = useRef<number | null>(null)
  const r = opties[i]

  return (
    <div className="paneel-achtergrond" onClick={sluit}>
      <div className="paneel kaart" role="dialog" aria-label="Gerecht ruilen" onClick={(e) => e.stopPropagation()}>
        {r ? (
          <div
            className="ruilkaart"
            onPointerDown={(e) => (startX.current = e.clientX)}
            onPointerUp={(e) => {
              if (startX.current === null) return
              const dx = e.clientX - startX.current
              startX.current = null
              if (dx > 60) kies(r)
              else if (dx < -60) setI((n) => n + 1)
            }}
          >
            <h2>{r.titel}</h2>
            <p className="zacht">
              {r.tijdMinuten > 0 && `${r.tijdMinuten} min`}
              {r.dagen > 1 && ` · ${r.dagen} avonden`}
            </p>
            <p className="zacht klein">← overslaan · kiezen →</p>
          </div>
        ) : (
          <p className="zacht">Geen andere gerechten die passen.</p>
        )}
        <div className="knoppen">
          <button onClick={sluit}>Sluiten</button>
          {r && <button onClick={() => setI((n) => n + 1)}>Volgende</button>}
          {r && <button className="primair" onClick={() => kies(r)}>Kies</button>}
        </div>
      </div>
    </div>
  )
}
