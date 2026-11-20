import { useEffect, useState } from 'react'
import { schaalfactor } from '../core/boodschappen'
import { schaalStap, toonIngredient } from '../core/schalen'
import type { Recept } from '../core/types'
import { lees, schrijf } from './opslag'
import { useConcept } from './useConcept'
import type { AppData } from './useData'

/** Houdt het scherm aan zolang de pagina open is (waar ondersteund). */
function useSchermAan() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    let weg = false
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
    wl?.request('screen').then((l) => {
      if (weg) l.release().catch(() => {})
      else lock = l
    }).catch(() => {})
    return () => {
      weg = true
      lock?.release().catch(() => {})
    }
  }, [])
}

export function ReceptPagina({ recept: r, data }: { recept: Recept; data: AppData }) {
  useSchermAan()
  const menu = data.menu?.menu ?? null
  const concept = useConcept(data, menu)
  const opMenu = concept.gerechten.find((g) => g.receptId === r.id)
  const [losseEters, setLosseEters] = useState(data.instellingen.huishouden)
  const eters = opMenu?.eters ?? losseEters
  const zetEters = (n: number) => {
    const e = Math.max(1, n)
    if (opMenu) concept.wijzig(concept.gerechten.map((g) => (g.receptId === r.id ? { ...g, eters: e } : g)))
    else setLosseEters(e)
  }
  const factor = schaalfactor(r, eters)

  const vinkSleutel = `ffsjeffe.vinkjes.${menu?.ronde ?? 'los'}.${r.id}`
  const [vinkjes, setVinkjes] = useState<number[]>(() => lees<number[]>(vinkSleutel) ?? [])
  const wissel = (i: number) => {
    const nieuw = vinkjes.includes(i) ? vinkjes.filter((x) => x !== i) : [...vinkjes, i]
    setVinkjes(nieuw)
    schrijf(vinkSleutel, nieuw)
  }

  return (
    <article className="kook">
      <a className="terug" href="#/">‹ Menu</a>
      <h1 className="kop kook-kop">{r.titel}</h1>
      <div className="chips">
        {r.tijdMinuten > 0 && <span className="chip">{r.tijdMinuten} min</span>}
        {r.avonden > 1 && <span className="chip">{r.avonden} avonden</span>}
        <span className="chip accent eters-chip">
          <button aria-label="Minder eters" onClick={() => zetEters(eters - 1)} disabled={eters <= 1}>−</button>
          <span aria-label="eters">{eters}</span>
          <button aria-label="Meer eters" onClick={() => zetEters(eters + 1)}>+</button>
          <span className="zacht">eters</span>
        </span>
      </div>

      <div className="eyebrow sectie">Ingrediënten</div>
      <ul className="ingredienten">
        {r.ingredienten.map((i, n) => {
          const tekst = toonIngredient(i, factor)
          return (
            <li key={n} className={vinkjes.includes(n) ? 'af' : ''}>
              <label>
                <input type="checkbox" checked={vinkjes.includes(n)} onChange={() => wissel(n)} aria-label={tekst} />
                <span>{tekst}</span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="eyebrow sectie">Bereiding</div>
      {r.stappen.length === 0 ? (
        <p className="zacht">Geen bereiding opgeschreven.</p>
      ) : (
        <ol className="stappen">
          {r.stappen.map((s, n) => (
            <li key={n}><span className="nr" aria-hidden="true">{n + 1}</span><span>{schaalStap(s, factor)}</span></li>
          ))}
        </ol>
      )}

      {r.notities && (
        <>
          <div className="eyebrow sectie">Notities</div>
          <p className="notities">{r.notities}</p>
        </>
      )}

      {r.bron && <p><a className="link-accent bron" href={r.bron} target="_blank" rel="noreferrer">Origineel recept ↗</a></p>}
    </article>
  )
}
