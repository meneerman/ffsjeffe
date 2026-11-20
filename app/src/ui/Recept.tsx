import { schaalfactor } from '../core/boodschappen'
import type { Recept } from '../core/types'

const getal = (x: number) => (Math.round(x * 10) / 10).toLocaleString('nl-NL')

export function ReceptPagina({ recept, huishouden }: { recept: Recept; huishouden: number }) {
  const factor = schaalfactor(recept, recept.dagen, huishouden)
  const personen = huishouden * recept.dagen
  return (
    <article>
      <p><a href="#/">‹ terug naar de week</a></p>
      <h1>{recept.titel}</h1>
      <p className="zacht">
        {`Voor ${personen} personen`}
        {recept.dagen > 1 && ` (${recept.dagen} avonden)`}
        {recept.tijdMinuten > 0 && ` · ${recept.tijdMinuten} min`}
      </p>
      <h2>Ingrediënten</h2>
      <ul className="kaart ingredienten">
        {recept.ingredienten.map((i, n) => (
          <li key={n}>
            {i.hoeveelheid === null
              ? i.naam
              : [getal(i.hoeveelheid * factor), i.eenheid && i.eenheid !== 'stuk' ? i.eenheid : null, i.naam].filter(Boolean).join(' ')}
          </li>
        ))}
      </ul>
      <h2>Bereiding</h2>
      <div className="kaart bereiding">{recept.bereiding.trim() || <span className="zacht">Geen bereiding opgeschreven.</span>}</div>
      {recept.bron && (
        <p><a href={recept.bron} target="_blank" rel="noreferrer">Origineel recept</a></p>
      )}
    </article>
  )
}
