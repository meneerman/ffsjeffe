import type { Transition, Variants } from 'motion/react'

/** Eén bewegingstaal voor de hele app. Snel: knoppen, schakelaar, stapel. Zacht: vensters en lijsten. */
export const snel: Transition = { type: 'spring', stiffness: 520, damping: 38 }
export const zacht: Transition = { type: 'spring', stiffness: 260, damping: 30 }

/** Venster dat als een sheet van onderen omhoog glijdt. */
export const sheet: Variants = {
  verborgen: { y: 40, opacity: 0 },
  zichtbaar: { y: 0, opacity: 1, transition: zacht },
}

/** De donkere laag achter een venster. */
export const achtergrondVervaag: Variants = {
  verborgen: { opacity: 0 },
  zichtbaar: { opacity: 1, transition: { duration: 0.2 } },
}

/** Kaart of regel die in een lijst verschijnt of verdwijnt. */
export const lijstItem: Variants = {
  verborgen: { opacity: 0, y: 8 },
  zichtbaar: { opacity: 1, y: 0, transition: zacht },
  weg: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0, transition: { duration: 0.2 } },
}

/** Indrukeffect bij tikken. */
export const druk = { scale: 0.97 }

const AFSTAND = 100
const SNELHEID = 500

/** Sleepbeslissing van de stapel: ver of snel genoeg naar rechts = erbij, naar links = nee, anders terugveren. */
export function beslis(offsetX: number, snelheidX: number): 'erbij' | 'nee' | null {
  if (offsetX > AFSTAND || snelheidX > SNELHEID) return 'erbij'
  if (offsetX < -AFSTAND || snelheidX < -SNELHEID) return 'nee'
  return null
}
