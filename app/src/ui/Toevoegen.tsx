import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { Recept } from '../core/types'
import type { Winkels } from '../core/winkels'
import { achtergrondVervaag, beslis, druk, sheet, snel } from './beweging'
import { ReceptWinkelbordjes } from './Winkel'

type Richting = 'erbij' | 'nee'

/**
 * Tinder-stapel: slepen naar rechts = erbij, naar links = nee; de knoppen doen hetzelfde.
 * Slepen loopt via een motion value (geen React-render per frame). Elke tik besluit meteen over de bovenste kaart;
 * die vliegt weg terwijl de volgende al klaarstaat, dus snel achter elkaar tikken slaat geen kaart over.
 */
export function Toevoegen({ opties, kies, sluit, meta, winkels }: { opties: Recept[]; kies: (r: Recept) => void; sluit: () => void; meta: (r: Recept) => string; winkels: Winkels }) {
  const [i, setI] = useState(0)
  const [richting, setRichting] = useState<Richting>('nee')
  const gekozen = useRef<Recept | null>(null)
  // hoe ver de bovenste kaart gesleept is, voor de kaart eronder
  const voortgang = useMotionValue(0)
  const onderSchaal = useTransform(voortgang, [-100, 0, 100], [1, 0.94, 1])
  const onderY = useTransform(voortgang, [-100, 0, 100], [0, 10, 0])

  const boven = opties[i]
  const onder = opties[i + 1]

  const vlieg = (r: Richting) => {
    if (!boven || gekozen.current) return
    setRichting(r)
    if (r === 'erbij') gekozen.current = boven
    setI((n) => n + 1)
  }

  return (
    <motion.div className="paneel-achtergrond" variants={achtergrondVervaag} initial="verborgen" animate="zichtbaar" exit="verborgen" onClick={sluit}>
      <motion.div className="paneel deck-paneel" role="dialog" aria-label="Gerecht toevoegen" variants={sheet} initial="verborgen" animate="zichtbaar" exit="verborgen" onClick={(e) => e.stopPropagation()}>
        <div className="deck-kop">
          <div className="eyebrow">gerecht erbij</div>
          <button className="link-zacht" onClick={sluit}>Sluiten</button>
        </div>

        <div className="stapel">
          {onder && (
            <motion.div key={`onder-${onder.id}`} data-testid="deck-kaart" className="deck-kaart onder" style={{ scale: onderSchaal, y: onderY }}>
              <h2 className="kop-klein">{onder.titel}</h2>
              <p className="zacht">{meta(onder)}</p>
              <ReceptWinkelbordjes recept={onder} winkels={winkels} />
            </motion.div>
          )}
          <AnimatePresence custom={richting} onExitComplete={() => { if (gekozen.current) kies(gekozen.current) }}>
            {boven && !gekozen.current && (
              <BovensteKaart key={boven.id} recept={boven} meta={meta(boven)} winkels={winkels} voortgang={voortgang} besluit={vlieg} />
            )}
          </AnimatePresence>
          {!boven && <p className="zacht deck-leeg">Geen andere gerechten meer.</p>}
        </div>

        <div className="deck-knoppen">
          <motion.button whileTap={druk} className="rond rond-terug" aria-label="Terug" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}>↺</motion.button>
          <motion.button whileTap={druk} className="rond rond-nee" aria-label="Nee" onClick={() => vlieg('nee')} disabled={!boven}>✕</motion.button>
          <motion.button whileTap={druk} className="rond rond-ja" aria-label="Erbij" onClick={() => vlieg('erbij')} disabled={!boven}>✓</motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

const uitvliegen = {
  weg: (r: Richting) => ({ x: r === 'erbij' ? 600 : -600, opacity: 0, transition: snel }),
}

function BovensteKaart({ recept, meta, winkels, voortgang, besluit }: { recept: Recept; meta: string; winkels: Winkels; voortgang: MotionValue<number>; besluit: (r: Richting) => void }) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-300, 300], [-16, 16])
  const erbij = useTransform(x, [0, 100], [0, 1])
  const nee = useTransform(x, [-100, 0], [1, 0])
  const actief = useIsPresent()

  // alleen de kaart die nog bovenop ligt bepaalt hoe groot de kaart eronder is
  useEffect(() => { voortgang.set(0) }, [voortgang])
  useMotionValueEvent(x, 'change', (v) => { if (actief) voortgang.set(v) })

  return (
    <motion.div
      data-testid={actief ? 'bovenste' : 'uitvliegend'}
      className="deck-kaart-wrap"
      style={{ x, rotate }}
      initial={{ scale: 0.94, y: 10 }}
      animate={{ scale: 1, y: 0, transition: snel }}
      exit="weg"
      variants={uitvliegen}
      drag={actief ? 'x' : false}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        const b = beslis(info.offset.x, info.velocity.x)
        if (b) besluit(b)
        else animate(x, 0, snel)
      }}
    >
      <div data-testid={actief ? 'deck-kaart' : undefined} className="deck-kaart boven">
        <motion.span className="stempel erbij" style={{ opacity: erbij }}>ERBIJ</motion.span>
        <motion.span className="stempel nee" style={{ opacity: nee }}>NEE</motion.span>
        <h2 className="kop-klein">{recept.titel}</h2>
        <p className="zacht">{meta}</p>
        <ReceptWinkelbordjes recept={recept} winkels={winkels} />
      </div>
    </motion.div>
  )
}
