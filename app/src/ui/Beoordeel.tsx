import { useRef, useState } from 'react'
import { Venster } from './Venster'

export type Vraag = { titel: string; begin: number | null }

/** "Gegeten?" met sterren. Open zolang `vraag` gevuld is. */
export function Beoordeel({ vraag, bezig, sluit, bevestig }: { vraag: Vraag | null; bezig: boolean; sluit: () => void; bevestig: (sterren: number | null) => void }) {
  const [keuze, setKeuze] = useState<{ vraag: Vraag; sterren: number | null } | null>(null)
  // tijdens het wegglijden van het venster blijft de laatst gevraagde titel staan
  const laatste = useRef(vraag)
  if (vraag) laatste.current = vraag
  const sterren = keuze && keuze.vraag === vraag ? keuze.sterren : (laatste.current?.begin ?? null)
  const kies = (n: number) => { if (vraag) setKeuze({ vraag, sterren: n }) }
  return (
    <Venster open={!!vraag} sluit={sluit} label="Gegeten?">
      <h2 className="kop-klein">Gegeten?</h2>
      <p className="zacht">{laatste.current?.titel}. Hoe was het?</p>
      <div className="sterren" role="group" aria-label="Beoordeling">
        <button className={`ster nul${sterren === 0 ? ' aan' : ''}`} aria-label="0 sterren" aria-pressed={sterren === 0} onClick={() => kies(0)}>0</button>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={`ster${sterren !== null && n <= sterren ? ' aan' : ''}`} aria-label={`${n} ${n === 1 ? 'ster' : 'sterren'}`} aria-pressed={sterren === n} onClick={() => kies(n)}>★</button>
        ))}
      </div>
      <div className="knoppenrij">
        <button className="knop" onClick={sluit}>Annuleren</button>
        <button className="knop primair" disabled={bezig} onClick={() => bevestig(sterren)}>Bevestigen</button>
      </div>
    </Venster>
  )
}
