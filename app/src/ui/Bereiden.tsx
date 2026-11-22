import { motion } from 'motion/react'
import { aantalPorties } from '../core/schalen'
import type { Menu, Recept } from '../core/types'
import { dagenGeleden } from '../core/voorstel'
import { lijstItem } from './beweging'

export function geledenTekst(datum: string | undefined, nu: Date): string {
  if (!datum) return 'nog nooit'
  const d = dagenGeleden(datum, nu)
  return d <= 0 ? 'vandaag' : d === 1 ? 'gisteren' : `${d} dagen geleden`
}

/** De bereid-modus: het vastgezette menu, de boodschappen zijn gedaan. Alleen kijken, koken en afvinken. */
export function Bereiden({ menu, perId, nu, bezig, wisselGegeten }: {
  menu: Menu
  perId: Record<string, Recept>
  nu: Date
  bezig: boolean
  wisselGegeten: (r: Recept) => void
}) {
  const lijst = menu.gerechten.filter((g) => perId[g.receptId])
  const gegeten = lijst.filter((g) => g.gegetenOp).length
  const getoond = [...lijst].sort((a, b) => Number(!!a.gegetenOp) - Number(!!b.gegetenOp))
  return (
    <>
      <p className="zacht klein voortgang">{gegeten} van {lijst.length} gegeten</p>
      <ul className="gerechten">
        {getoond.map((g) => {
          const r = perId[g.receptId]
          const meta = [
            r.soort !== 'avondeten' && r.soort,
            `${g.eters} eters`,
            g.avonden > 1 && `${g.avonden} avonden`,
            `${aantalPorties(g.eters, g.avonden)} porties`,
            r.tijdMinuten > 0 && `${r.tijdMinuten} min`,
            r.vooraf && `⏳ ${r.vooraf}`,
          ].filter(Boolean).join(' · ')
          return (
            <motion.li layout variants={lijstItem} initial={false} animate="zichtbaar" key={g.receptId} data-testid="gerecht" className={`gerecht-rij${g.gegetenOp ? ' gegeten' : ''}`}>
              <div className="kaart gerecht bereid">
                <div className="gerecht-kop">
                  <div className="gerecht-tekst">
                    <a className="titel" href={`#/recept/${encodeURIComponent(r.id)}`}>{r.titel}</a>
                    <div className="meta zacht">{g.gegetenOp ? `✓ gegeten ${geledenTekst(g.gegetenOp, nu)}` : meta}</div>
                  </div>
                </div>
                <div className="gerecht-bediening">
                  <button className={`gegeten-knop${g.gegetenOp ? ' aan' : ''}`} aria-label={`${r.titel} gegeten`} aria-pressed={!!g.gegetenOp} onClick={() => wisselGegeten(r)} disabled={bezig}>
                    ✓<span className="label"> Gegeten</span>
                  </button>
                </div>
              </div>
            </motion.li>
          )
        })}
      </ul>
    </>
  )
}
