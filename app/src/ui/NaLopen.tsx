import { AnimatePresence, motion } from 'motion/react'
import { groepeerPerCategorie, type BoodschappenItem } from '../core/boodschappen'
import type { Categorieen } from '../core/types'
import { GEEN_WINKELS, type Winkels } from '../core/winkels'
import { lijstItem } from './beweging'
import { useSleepVinken } from './useSleepVinken'
import { Winkelbordjes } from './Winkel'

type Props = {
  items: BoodschappenItem[]
  categorieen: Categorieen
  /** wat bij Lidl of de Albert Heijn niet te koop is, voor de doorgestreepte winkeliconen */
  winkels?: Winkels
  /** regels die deze ronde niet naar Keep gaan */
  uit: Set<string>
  onWissel: (regel: string) => void
}

/** De lijst die naar Keep gaat, per supermarktafdeling, om na te lopen: vink uit wat je al in huis hebt. */
export function NaLopen({ items, categorieen, winkels = GEEN_WINKELS, uit, onWissel }: Props) {
  const sleep = useSleepVinken((regel) => !uit.has(regel), (regel, aan) => { if (aan === uit.has(regel)) onWissel(regel) })
  if (items.length === 0) return null
  const aan = items.filter((i) => !uit.has(i.regel)).length
  return (
    <section className="nalopen" {...sleep.lijst}>
      <h2 className="nalopen-kop">
        Boodschappen <span className="zacht">({aan} van {items.length})</span>
      </h2>
      {groepeerPerCategorie(items, categorieen).map((g) => (
        <div key={g.categorie} className="kaart nalopen-groep">
          <h3>{g.categorie}</h3>
          <ul>
            <AnimatePresence initial={false}>
            {g.items.map((i) => (
              <motion.li key={i.regel} data-vink-id={i.regel} layout variants={lijstItem} initial="verborgen" animate="zichtbaar" exit="weg">
                <label>
                  <input type="checkbox" checked={!uit.has(i.regel)} onChange={() => onWissel(i.regel)} {...sleep.vinkvak(i.regel)} />
                  <span>{i.regel}</span>
                  <Winkelbordjes naam={i.naam} winkels={winkels} />
                </label>
              </motion.li>
            ))}
            </AnimatePresence>
          </ul>
        </div>
      ))}
    </section>
  )
}
