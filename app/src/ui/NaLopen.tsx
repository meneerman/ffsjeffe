import { groepeerPerCategorie, type BoodschappenItem } from '../core/boodschappen'
import type { Categorieen } from '../core/types'

type Props = {
  items: BoodschappenItem[]
  categorieen: Categorieen
  /** regels die deze ronde niet naar Keep gaan */
  uit: Set<string>
  onWissel: (regel: string) => void
}

/** De lijst die naar Keep gaat, per supermarktafdeling, om na te lopen: vink uit wat je al in huis hebt. */
export function NaLopen({ items, categorieen, uit, onWissel }: Props) {
  if (items.length === 0) return null
  const aan = items.filter((i) => !uit.has(i.regel)).length
  return (
    <section className="nalopen">
      <h2 className="nalopen-kop">
        Boodschappen <span className="zacht">({aan} van {items.length})</span>
      </h2>
      {groepeerPerCategorie(items, categorieen).map((g) => (
        <div key={g.categorie} className="kaart nalopen-groep">
          <h3>{g.categorie}</h3>
          <ul>
            {g.items.map((i) => (
              <li key={i.regel}>
                <label>
                  <input type="checkbox" checked={!uit.has(i.regel)} onChange={() => onWissel(i.regel)} />
                  <span>{i.regel}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
