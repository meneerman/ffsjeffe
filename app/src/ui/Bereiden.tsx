import { motion } from 'motion/react'
import { useState } from 'react'
import { aantalPorties } from '../core/schalen'
import type { Batch, Menu, Recept } from '../core/types'
import { dagenGeleden } from '../core/voorstel'
import type { Winkels } from '../core/winkels'
import { lijstItem } from './beweging'
import { Boodschappen } from './Boodschappen'
import { Beoordeel, type Vraag } from './Beoordeel'
import { ReceptWinkelbordjes } from './Winkel'

export function geledenTekst(datum: string | undefined, nu: Date): string {
  if (!datum) return 'nog nooit'
  const d = dagenGeleden(datum, nu)
  return d <= 0 ? 'vandaag' : d === 1 ? 'gisteren' : `${d} dagen geleden`
}

const datumKort = (iso: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))

/** De bereid-modus: per kookbatch (wat in één keer naar Keep ging) kijken, koken en afvinken. */
export function Bereiden({ menu, perId, nu, bezig, zetGegeten, winkels }: {
  menu: Menu
  perId: Record<string, Recept>
  nu: Date
  bezig: boolean
  zetGegeten: (batchId: string, r: Recept, gegeten: boolean, beoordeling: number | null) => void | Promise<void>
  winkels: Winkels
}) {
  const zichtbaar = (b: Batch) => b.gerechten.filter((g) => perId[g.receptId])
  const batches = menu.batches.filter((b) => zichtbaar(b).length > 0)
  const klaar = (b: Batch) => zichtbaar(b).every((g) => g.gegetenOp)
  // oudste eerst; een batch waar alles gegeten is gaat naar onder
  const getoond = [...batches].sort((a, b) => Number(klaar(a)) - Number(klaar(b)))
  const totaal = batches.reduce((n, b) => n + zichtbaar(b).length, 0)
  const gegeten = batches.reduce((n, b) => n + zichtbaar(b).filter((g) => g.gegetenOp).length, 0)

  const [vraag, setVraag] = useState<(Vraag & { batchId: string; recept: Recept }) | null>(null)
  const open = (batchId: string, recept: Recept) => setVraag({ batchId, recept, titel: recept.titel, begin: menu.beoordelingen[recept.id] ?? null })
  const bevestig = (sterren: number | null) => {
    if (!vraag) return
    const { batchId, recept } = vraag
    setVraag(null)
    void zetGegeten(batchId, recept, true, sterren)
  }

  return (
    <>
      <p className="zacht klein voortgang">{gegeten} van {totaal} gegeten</p>
      {getoond.map((b) => {
        const lijst = [...zichtbaar(b)].sort((a, c) => Number(!!a.gegetenOp) - Number(!!c.gegetenOp))
        return (
          <section key={b.id} className="batch" data-testid="batch" aria-label={`Besteld ${datumKort(b.vastgezetOp)}`}>
            <h2 className="batch-kop">Besteld {datumKort(b.vastgezetOp)}</h2>
            <ul className="gerechten">
              {lijst.map((g) => {
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
                          <div className="meta-rij">
                            <span className="meta zacht">{g.gegetenOp ? `✓ gegeten ${geledenTekst(g.gegetenOp, nu)}` : meta}</span>
                            <ReceptWinkelbordjes recept={r} winkels={winkels} />
                          </div>
                        </div>
                        <button className={`gegeten-knop rond-knop${g.gegetenOp ? ' aan' : ''}`} aria-label={`${r.titel} gegeten`} aria-pressed={!!g.gegetenOp}
                          onClick={() => (g.gegetenOp ? void zetGegeten(b.id, r, false, null) : open(b.id, r))} disabled={bezig}>
                          <span aria-hidden="true">✓</span>
                        </button>
                      </div>
                    </div>
                  </motion.li>
                )
              })}
            </ul>
            <Boodschappen titel="In huis (uit Keep)" regels={b.boodschappen} />
          </section>
        )
      })}

      <Beoordeel vraag={vraag} bezig={bezig} sluit={() => setVraag(null)} bevestig={bevestig} />
    </>
  )
}
