import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { verlooptNa } from '../core/menu'
import type { Concept, Gerecht, Menu } from '../core/types'
import { VerouderdFout } from '../data/github'
import { lees, schrijf } from './opslag'
import type { AppData, Repo } from './useData'

const SLEUTEL = 'ffsjeffe.concept'
type Lokaal = { gerechten: Gerecht[]; sinds: string; door?: string }

export type ConceptOpslag = { status: 'stil' | 'bezig' | 'bewaard' | 'mislukt'; fout: Error | null }

const tijd = (c: { sinds: string } | null) => (c ? Date.parse(c.sinds) : NaN)

/**
 * Het menu in de maak, tot vastzetten. Het wordt automatisch bewaard in een gedeeld concept op GitHub
 * (weekmenu/concept.json, niet menu.json: alleen menu.json start de Keep-sync), zodat twee mensen los van
 * elkaar kunnen voorbereiden en één van hen later naar Keep stuurt.
 *
 * Volgorde: nieuwste geldige concept (lokaal of gedeeld), anders leeg (geen automatisch voorstel meer).
 * Een concept vervalt als iemand daarna (opnieuw) vastzette of leegmaakte.
 * Schrijven gaat met uitstel; bij een botsing met de ander wint de laatste schrijver.
 */
export function useConcept(data: AppData, menu: Menu | null, repo: Repo, naam: string, vertraging = 1200) {
  const [lokaal, setLokaal] = useState<Lokaal | null>(() => lees<Lokaal>(SLEUTEL))
  const [opslag, setOpslag] = useState<ConceptOpslag>({ status: 'stil', fout: null })

  const verloop = verlooptNa(menu)
  const geldig = <T extends { gerechten: Gerecht[]; sinds: string }>(c: T | null | undefined): T | null =>
    c && Array.isArray(c.gerechten) && !Number.isNaN(tijd(c)) && !(verloop && Date.parse(verloop) >= tijd(c)) ? c : null
  const geldigLokaal = geldig(lokaal)
  const geldigGedeeld = geldig(data.concept?.concept)
  const actief: (Lokaal & { bron: 'lokaal' | 'gedeeld' }) | null =
    geldigGedeeld && (!geldigLokaal || tijd(geldigGedeeld) >= tijd(geldigLokaal))
      ? { ...geldigGedeeld, bron: 'gedeeld' }
      : geldigLokaal ? { ...geldigLokaal, bron: 'lokaal' } : null

  useEffect(() => {
    if (lokaal && !geldigLokaal) {
      schrijf(SLEUTEL, null)
      setLokaal(null)
    }
  }, [lokaal, geldigLokaal])

  const { recepten } = data
  const perId = useMemo(() => new Map(recepten.map((r) => [r.id, r])), [recepten])

  // gerechten waarvan het recept weg is vallen eruit; oude menu's zonder avonden krijgen de standaard van het recept
  const gerechten = (actief?.gerechten ?? [])
    .filter((g) => perId.has(g.receptId))
    .map((g) => (typeof g.avonden === 'number' && g.avonden >= 1 ? g : { ...g, avonden: perId.get(g.receptId)!.avonden }))
  const laatste = useRef(gerechten)
  laatste.current = gerechten

  // ---- bewaren op GitHub ----
  const repoRef = useRef(repo)
  repoRef.current = repo
  const sha = useRef<string | null>(data.concept?.sha ?? null)
  useEffect(() => { sha.current = data.concept?.sha ?? null }, [data.concept])
  const wacht = useRef<Concept | null>(null)
  const bezig = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const bericht = `Concept van ${naam}`

  const bewaar = useCallback(async () => {
    if (bezig.current || !wacht.current) return
    bezig.current = true
    setOpslag({ status: 'bezig', fout: null })
    let huidig: Concept | null = wacht.current
    try {
      while (huidig) {
        wacht.current = null
        try {
          sha.current = await repoRef.current.zetConcept(huidig, sha.current, bericht)
        } catch (e) {
          if (!(e instanceof VerouderdFout)) throw e
          // de ander bewaarde net: pak de nieuwste sha en schrijf ons concept er overheen
          sha.current = (await repoRef.current.concept())?.sha ?? null
          sha.current = await repoRef.current.zetConcept(huidig, sha.current, bericht)
        }
        huidig = wacht.current
      }
      setOpslag({ status: 'bewaard', fout: null })
    } catch (e) {
      wacht.current ??= huidig // opnieuw proberen kan
      setOpslag({ status: 'mislukt', fout: e as Error })
    } finally {
      bezig.current = false
    }
  }, [bericht])

  const plan = useCallback((c: Concept) => {
    wacht.current = c
    clearTimeout(timer.current)
    timer.current = setTimeout(bewaar, vertraging)
  }, [bewaar, vertraging])

  // een lokaal concept dat nog nergens staat (app was dicht voor het bewaard was) alsnog bewaren
  const beginKlaar = useRef(false)
  useEffect(() => {
    if (beginKlaar.current) return
    beginKlaar.current = true
    if (geldigLokaal && (!geldigGedeeld || tijd(geldigLokaal) > tijd(geldigGedeeld))) {
      plan({ gerechten: geldigLokaal.gerechten, sinds: geldigLokaal.sinds, door: geldigLokaal.door ?? naam })
    }
    // alleen bij het openen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // wegnavigeren of de app verbergen: wat nog wacht meteen wegschrijven
  useEffect(() => {
    const flush = () => { clearTimeout(timer.current); void bewaar() }
    const verborgen = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', verborgen)
    return () => {
      document.removeEventListener('visibilitychange', verborgen)
      flush()
    }
  }, [bewaar])

  return {
    gerechten,
    heeftConcept: actief !== null,
    /** wie het concept het laatst wijzigde */
    door: actief?.door ?? null,
    opslag,
    /** Accepteert een lijst of een functie op de nieuwste lijst (veilig vanuit timers). */
    wijzig(nieuw: Gerecht[] | ((huidig: Gerecht[]) => Gerecht[])) {
      const lijst = typeof nieuw === 'function' ? nieuw(laatste.current) : nieuw
      laatste.current = lijst
      const c: Concept = { gerechten: lijst, sinds: new Date().toISOString(), door: naam }
      schrijf(SLEUTEL, c)
      setLokaal(c)
      plan(c)
    },
    bewaarOpnieuw() { void bewaar() },
    wis() {
      clearTimeout(timer.current)
      wacht.current = null
      schrijf(SLEUTEL, null)
      setLokaal(null)
      setOpslag({ status: 'stil', fout: null })
    },
  }
}
