import { useEffect, useState } from 'react'
import { schaalfactor } from '../core/boodschappen'
import { gerechtVoorRecept } from '../core/menu'
import { aantalPorties, schaalStap, toonIngredient } from '../core/schalen'
import type { Recept } from '../core/types'
import { lees, schrijf } from './opslag'
import { Stapper } from './Stapper'
import { useConcept } from './useConcept'
import { buitenAh, buitenLidl } from '../core/winkels'
import { useSleepVinken } from './useSleepVinken'
import { Winkelbord, Winkelbordjes } from './Winkel'
import type { AppData, Repo } from './useData'

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

export function ReceptPagina({ recept: r, data, repo, naam }: { recept: Recept; data: AppData; repo: Repo; naam: string }) {
  const schermAan = useSchermAan()
  const menu = data.menu?.menu ?? null
  const concept = useConcept(data, menu, repo, naam)
  const opMenu = concept.gerechten.find((g) => g.receptId === r.id)
  // een al vastgezet gerecht kook je met de eters en avonden waarmee het gekocht is; die aanpassen kan hier alleen voor dit scherm
  const beoordeling = menu?.beoordelingen[r.id]
  const besteld = gerechtVoorRecept(menu, r.id)
  const vastgezet = besteld?.gerecht
  const [los, setLos] = useState({ eters: vastgezet?.eters ?? data.instellingen.huishouden, avonden: vastgezet?.avonden ?? r.avonden })
  const eters = opMenu?.eters ?? los.eters
  const avonden = opMenu?.avonden ?? los.avonden
  const zet = (veld: 'eters' | 'avonden', n: number) => {
    const w = Math.max(1, n)
    if (opMenu) concept.wijzig((huidig) => huidig.map((g) => (g.receptId === r.id ? { ...g, [veld]: w } : g)))
    else setLos((l) => ({ ...l, [veld]: w }))
  }
  const factor = schaalfactor(r, eters, avonden)
  // origineel: eters × avonden = porties zoals het recept geschreven is
  const orig = r.porties % r.avonden === 0 ? { eters: r.porties / r.avonden, avonden: r.avonden } : { eters: r.porties, avonden: 1 }
  const isOrigineel = eters * avonden === r.porties
  const naarOrigineel = () => {
    if (opMenu) concept.wijzig((huidig) => huidig.map((g) => (g.receptId === r.id ? { ...g, ...orig } : g)))
    else setLos(orig)
  }

  const sleutel = `ffsjeffe.koken.${besteld?.batch.id ?? 'los'}.${r.id}`
  const [vg, setVg] = useState<Voortgang>(() => ({ i: [], v: [], s: [], ...(lees<Partial<Voortgang>>(sleutel) ?? {}) }))
  const wissel = (soort: keyof Voortgang, n: number) => {
    setVg((oud) => {
      const nieuw = { ...oud, [soort]: oud[soort].includes(n) ? oud[soort].filter((x) => x !== n) : [...oud[soort], n] }
      schrijf(sleutel, nieuw)
      return nieuw
    })
  }
  const zetVink = (soort: 'i' | 'v') => (id: string, aan: boolean) => { if (vg[soort].includes(Number(id)) !== aan) wissel(soort, Number(id)) }
  const sleepI = useSleepVinken((id) => vg.i.includes(Number(id)), zetVink('i'))
  const sleepV = useSleepVinken((id) => vg.v.includes(Number(id)), zetVink('v'))

  const zonderLidl = r.ingredienten.filter((i) => buitenLidl(i.naam, data.winkels)).map((i) => i.naam)
  const zonderAh = r.ingredienten.filter((i) => buitenAh(i.naam, data.winkels)).map((i) => i.naam)
  const huidigeStap = r.stappen.findIndex((_, n) => !vg.s.includes(n))

  return (
    <article className="kook">
      <a className="terug" href="#/">‹ Menu</a>
      <h1 className="kop kook-kop">{r.titel}</h1>
      {beoordeling !== undefined && (
        <p className="beoordeling zacht" aria-label={`Beoordeling ${beoordeling} van 5`}>{'★'.repeat(beoordeling)}{'☆'.repeat(5 - beoordeling)} <span className="klein">{beoordeling} van 5</span></p>
      )}
      <div className="chips">
        {r.tijdMinuten > 0 && <span className="chip">{r.tijdMinuten} min</span>}
        {r.vooraf && <span className="chip vooraf">⏳ Vooraf: {r.vooraf}</span>}
        {zonderLidl.length > 0 && <span className="chip winkelchip"><Winkelbord winkel="lidl" wat={zonderLidl.join(', ')} /><span>{zonderLidl.join(', ')}</span></span>}
        {zonderAh.length > 0 && <span className="chip winkelchip"><Winkelbord winkel="ah" wat={zonderAh.join(', ')} /><span>{zonderAh.join(', ')}</span></span>}
        <Stapper naam="eters" icoon="👤" waarde={eters} wijzig={(n) => zet('eters', n)} />
        <Stapper naam="avonden" icoon="☾" waarde={avonden} wijzig={(n) => zet('avonden', n)} />
        {avonden > 1 && <span className="chip accent">{aantalPorties(eters, avonden)} porties</span>}
        {!isOrigineel && <button className="chip origineel" onClick={naarOrigineel} aria-label={`Origineel (${r.porties} porties)`}><span aria-hidden="true">↺</span> Origineel ({r.porties} porties)</button>}
        {r.invriezen && <span className="chip vries">❄ Invriesbaar</span>}
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
      <ul className="vinklijst" {...sleepI.lijst}>
        {r.ingredienten.map((i, n) => {
          const tekst = toonIngredient(i, factor)
          return (
            <li key={n} data-vink-id={String(n)} className={vg.i.includes(n) ? 'af' : ''}>
              <label>
                <input type="checkbox" checked={vg.i.includes(n)} onChange={() => wissel('i', n)} aria-label={tekst} {...sleepI.vinkvak(String(n))} />
                <span>{tekst}</span>
                <Winkelbordjes naam={i.naam} winkels={data.winkels} />
              </label>
            </li>
          )
        })}
      </ul>

      {r.voorbereiding.length > 0 && (
        <>
          <div className="eyebrow sectie">Voorbereiding</div>
          <ul className="vinklijst voorbereiding" {...sleepV.lijst}>
            {r.voorbereiding.map((v, n) => {
              const tekst = schaalStap(v, factor)
              return (
                <li key={n} data-vink-id={String(n)} className={vg.v.includes(n) ? 'af' : ''}>
                  <label>
                    <input type="checkbox" checked={vg.v.includes(n)} onChange={() => wissel('v', n)} aria-label={tekst} {...sleepV.vinkvak(String(n))} />
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
