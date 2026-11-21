/** − waarde + met een klein icoon; minimaal 1. Labels: "Minder <naam>", "<naam>", "Meer <naam>". */
export function Stapper({ naam, icoon, waarde, wijzig, klein = false }: { naam: string; icoon: string; waarde: number; wijzig: (n: number) => void; klein?: boolean }) {
  return (
    <div className={`stapper${klein ? ' klein' : ''}`} role="group" aria-label={`aantal ${naam}`}>
      <button aria-label={`Minder ${naam}`} onClick={() => wijzig(waarde - 1)} disabled={waarde <= 1}>−</button>
      <span className="stapper-waarde"><span className="icoon" aria-hidden="true">{icoon}</span><span aria-label={naam}>{waarde}</span></span>
      <button aria-label={`Meer ${naam}`} onClick={() => wijzig(waarde + 1)}>+</button>
    </div>
  )
}
