import { useState } from 'react'

/** − waarde + met een klein icoon; minimaal 1. Labels: "Minder <naam>", "<naam>", "Meer <naam>". */
export function Stapper({ naam, icoon, waarde, wijzig, klein = false }: { naam: string; icoon: string; waarde: number; wijzig: (n: number) => void; klein?: boolean }) {
  // het getal tikt alleen na een wijziging, niet als de pagina opent
  const [begin] = useState(waarde)
  const [gewijzigd, setGewijzigd] = useState(false)
  if (!gewijzigd && waarde !== begin) setGewijzigd(true)
  return (
    <div className={`stapper${klein ? ' klein' : ''}`} role="group" aria-label={`aantal ${naam}`}>
      <button aria-label={`Minder ${naam}`} onClick={() => wijzig(waarde - 1)} disabled={waarde <= 1}>−</button>
      <span className="stapper-waarde"><span className="icoon" aria-hidden="true">{icoon}</span><span key={waarde} className={`stapper-getal${gewijzigd ? ' tik' : ''}`} aria-label={naam}>{waarde}</span></span>
      <button aria-label={`Meer ${naam}`} onClick={() => wijzig(waarde + 1)}>+</button>
    </div>
  )
}
