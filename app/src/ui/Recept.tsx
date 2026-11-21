import { useEffect, useState } from 'react'
import { schaalfactor } from '../core/boodschappen'
import { aantalPorties, schaalStap, toonIngredient } from '../core/schalen'
import type { Recept } from '../core/types'
import { lees, schrijf } from './opslag'
import { useConcept } from './useConcept'
import type { AppData } from './useData'

type Lock = { release: () => Promise<void>; released?: boolean; addEventListener?: (t: 'release', f: () => void) => void }
type WakeLockApi = { request: (t: 'screen') => Promise<Lock> }

/**
 * Houdt het scherm aan zolang de pagina open is. Telefoons laten de vergrendeling los zodra je
 * de app even verlaat; bij terugkomen wordt hij opnieuw aangevraagd. Geeft terug of hij actief is.
 */
function useSchermAan(): boolean {
  const [actief, setActief] = useState(false)
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock
    if (!wl) return
    let lock: Lock | null = null
    let weg = false
    const vraag = () => {
      if (weg || (lock && !lock.released)) return
      wl.request('screen').then((l) => {
        if (weg) return void l.release().catch(() => {})
        lock = l
        setActief(true)
        l.addEventListener?.('release', () => { lock = null; setActief(false) })
      }).catch(() => setActief(false))
    }
    const zichtbaar = () => { if (document.visibilityState === 'visible') { lock = lock?.released ? null : lock; vraag() } }
    vraag()
    document.addEventListener('visibilitychange', zichtbaar)
    return () => {
      weg = true
      document.removeEventListener('visibilitychange', zichtbaar)
      lock?.release().catch(() => {})
    }
  }, [])
  return actief
}

type Voortgang = { i: number[]; v: number[]; s: number[] }

export function ReceptPagina({ recept: r, data }: { recept: Recept; data: AppData }) {
  const schermAan = useSchermAan()
  const menu = data.menu?.menu ?? null
  const concept = useConcept(data, menu)
  const opMenu = concept.gerechten.find((g) => g.receptId === r.id)
  const [losseEters, setLosseEters] = useState(data.instellingen.huishouden)
  const eters = opMenu?.eters ?? losseEters
  const zetEters = (n: number) => {
    const e = Math.max(1, n)
    if (opMenu) concept.wijzig((huidig) => huidig.map((g) => (g.receptId === r.id ? { ...g, eters: e } : g)))
    else setLosseEters(e)
  }
  const factor = schaalfactor(r, eters)

  const sleutel = `ffsjeffe.koken.${menu?.ronde ?? 'los'}.${r.id}`
  const [vg, setVg] = useState<Voortgang>(() => ({ i: [], v: [], s: [], ...(lees<Partial<Voortgang>>(sleutel) ?? {}) }))
  const wissel = (soort: keyof Voortgang, n: number) => {
    setVg((oud) => {
      const nieuw = { ...oud, [soort]: oud[soort].includes(n) ? oud[soort].filter((x) => x !== n) : [...oud[soort], n] }
      schrijf(sleutel, nieuw)
      return nieuw
    })
  }
  const huidigeStap = r.stappen.findIndex((_, n) => !vg.s.includes(n))

  return (
    <article className="kook">
      <a className="terug" href="#/">‹ Menu</a>
      <h1 className="kop kook-kop">{r.titel}</h1>
      <div className="chips">
        {r.tijdMinuten > 0 && <span className="chip">{r.tijdMinuten} min</span>}
        {r.avonden > 1 && <span className="chip">{aantalPorties(r, eters)} porties · {r.avonden} avonden</span>}
        <span className="chip accent eters-chip">
          <button aria-label="Minder eters" onClick={() => zetEters(eters - 1)} disabled={eters <= 1}>−</button>
          <span aria-label="eters">{eters}</span>
          <button aria-label="Meer eters" onClick={() => zetEters(eters + 1)}>+</button>
          <span className="zacht">eters</span>
        </span>
        {schermAan && <span className="chip scherm-aan"><span className="puls" aria-hidden="true" />scherm blijft aan</span>}
      </div>

      {r.benodigdheden.length > 0 && (
        <>
          <div className="eyebrow sectie" id="kop-benodigdheden">Benodigdheden</div>
          <ul className="benodigdheden" aria-labelledby="kop-benodigdheden">
            {r.benodigdheden.map((b) => <li key={b} className="chip">{b}</li>)}
          </ul>
        </>
      )}

      <div className="eyebrow sectie">Ingrediënten</div>
      <ul className="vinklijst">
        {r.ingredienten.map((i, n) => {
          const tekst = toonIngredient(i, factor)
          return (
            <li key={n} className={vg.i.includes(n) ? 'af' : ''}>
              <label>
                <input type="checkbox" checked={vg.i.includes(n)} onChange={() => wissel('i', n)} aria-label={tekst} />
                <span>{tekst}</span>
              </label>
            </li>
          )
        })}
      </ul>

      {r.voorbereiding.length > 0 && (
        <>
          <div className="eyebrow sectie">Voorbereiding</div>
          <ul className="vinklijst voorbereiding">
            {r.voorbereiding.map((v, n) => {
              const tekst = schaalStap(v, factor)
              return (
                <li key={n} className={vg.v.includes(n) ? 'af' : ''}>
                  <label>
                    <input type="checkbox" checked={vg.v.includes(n)} onChange={() => wissel('v', n)} aria-label={tekst} />
                    <span>{tekst}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <div className="bereiding-kop">
        <div className="eyebrow sectie">Bereiding</div>
        {r.stappen.length > 0 && (
          <div className="voortgang zacht klein" aria-live="polite">
            {huidigeStap < 0 ? 'Klaar. Eet smakelijk!' : `Stap ${huidigeStap + 1} van ${r.stappen.length}`}
          </div>
        )}
      </div>
      {r.stappen.length === 0 ? (
        <p className="zacht">Geen bereiding opgeschreven.</p>
      ) : (
        <ol className="stappen">
          {r.stappen.map((s, n) => {
            const klaar = vg.s.includes(n)
            const nu = n === huidigeStap
            const tekst = schaalStap(s, factor)
            return (
              <li key={n}>
                <button
                  className={`stap${klaar ? ' klaar' : ''}${nu ? ' nu' : ''}`}
                  aria-label={`Stap ${n + 1}: ${tekst}`}
                  aria-pressed={klaar}
                  aria-current={nu ? 'step' : undefined}
                  onClick={() => wissel('s', n)}
                >
                  <span className="nr" aria-hidden="true">{klaar ? '✓' : n + 1}</span>
                  <span className="stap-tekst">{tekst}</span>
                </button>
              </li>
            )
          })}
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
