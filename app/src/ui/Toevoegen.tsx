import { useEffect, useRef, useState } from 'react'
import type { Recept } from '../core/types'

const DREMPEL = 100
const VLIEG_MS = 300

type Richting = 'erbij' | 'nee'

/** Tinder-stapel: slepen naar rechts = erbij, naar links = nee. Knoppen doen hetzelfde, met animatie. */
export function Toevoegen({ opties, kies, sluit, meta }: { opties: Recept[]; kies: (r: Recept) => void; sluit: () => void; meta: (r: Recept) => string }) {
  const [i, setI] = useState(0)
  const [d, setD] = useState({ x: 0, y: 0 })
  const [vliegt, setVliegt] = useState<Richting | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])

  const boven = opties[i]
  const onder = opties[i + 1]

  const vlieg = (richting: Richting) => {
    if (!boven || vliegt) return
    setVliegt(richting)
    timer.current = setTimeout(() => {
      if (richting === 'erbij') kies(boven)
      else setI((n) => n + 1)
      setVliegt(null)
      setD({ x: 0, y: 0 })
    }, VLIEG_MS)
  }

  const los = () => {
    if (!start.current) return
    start.current = null
    if (d.x > DREMPEL) vlieg('erbij')
    else if (d.x < -DREMPEL) vlieg('nee')
    else setD({ x: 0, y: 0 })
  }

  const x = vliegt === 'erbij' ? 600 : vliegt === 'nee' ? -600 : d.x
  const slepend = start.current !== null
  const voortgang = Math.min(1, Math.abs(d.x) / DREMPEL)

  return (
    <div className="paneel-achtergrond" onClick={sluit}>
      <div className="paneel deck-paneel" role="dialog" aria-label="Gerecht toevoegen" onClick={(e) => e.stopPropagation()}>
        <div className="deck-kop">
          <div className="eyebrow">gerecht erbij</div>
          <button className="link-zacht" onClick={sluit}>Sluiten</button>
        </div>

        <div className="stapel">
          {onder && (
            <div data-testid="deck-kaart" className="deck-kaart onder" style={{ transform: `scale(${0.94 + 0.06 * voortgang}) translateY(${10 - 10 * voortgang}px)` }}>
              <h2 className="kop-klein">{onder.titel}</h2>
              <p className="zacht">{meta(onder)}</p>
            </div>
          )}
          {boven ? (
            <div
              data-testid="bovenste"
              className="deck-kaart-wrap"
              style={{ transform: `translate(${x}px, ${vliegt ? d.y : d.y * 0.3}px) rotate(${x / 18}deg)`, transition: slepend ? 'none' : `transform ${VLIEG_MS}ms var(--veer)` }}
              onPointerDown={(e) => {
                if (vliegt) return
                start.current = { x: e.clientX, y: e.clientY }
                ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
              }}
              onPointerMove={(e) => { if (start.current) setD({ x: e.clientX - start.current.x, y: e.clientY - start.current.y }) }}
              onPointerUp={los}
              onPointerCancel={los}
            >
              <div data-testid="deck-kaart" className="deck-kaart boven">
                <span className="stempel erbij" style={{ opacity: vliegt === 'erbij' ? 1 : Math.max(0, d.x / DREMPEL) }}>ERBIJ</span>
                <span className="stempel nee" style={{ opacity: vliegt === 'nee' ? 1 : Math.max(0, -d.x / DREMPEL) }}>NEE</span>
                <h2 className="kop-klein">{boven.titel}</h2>
                <p className="zacht">{meta(boven)}</p>
              </div>
            </div>
          ) : (
            <p className="zacht deck-leeg">Geen andere gerechten meer.</p>
          )}
        </div>

        <div className="deck-knoppen">
          <button className="rond rond-terug" aria-label="Terug" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0 || !!vliegt}>↺</button>
          <button className="rond rond-nee" aria-label="Nee" onClick={() => vlieg('nee')} disabled={!boven}>✕</button>
          <button className="rond rond-ja" aria-label="Erbij" onClick={() => vlieg('erbij')} disabled={!boven}>✓</button>
        </div>
      </div>
    </div>
  )
}
