import { useEffect, useMemo, useRef, useState } from 'react'
import { behoeften, boodschappenRegels } from '../core/boodschappen'
import { leegmaken, markeerGegeten, vastzetten, zaadVoor } from '../core/menu'
import type { Menu as MenuT, Recept } from '../core/types'
import { pakOp, type PakOp } from '../core/pakop'
import { aantalPorties } from '../core/schalen'
import { dagenGeleden, kandidaten, stelVoor } from '../core/voorstel'
import { VerouderdFout } from '../data/github'
import type { SchermProps } from './App'
import { Boodschappen } from './Boodschappen'
import { KeepStatusMelding } from './KeepStatus'
import { Toevoegen } from './Toevoegen'
import { Stapper } from './Stapper'
import { useConcept } from './useConcept'

const UIT_MS = 420 // uitglijden + inklappen
const TREK_DREMPEL = 70

function geledenTekst(datum: string | undefined, nu: Date): string {
  if (!datum) return 'nog nooit'
  const d = dagenGeleden(datum, nu)
  return d <= 0 ? 'vandaag' : d === 1 ? 'gisteren' : `${d} dagen geleden`
}

/** "25 min · 12 porties · 18 dagen geleden"; porties alleen bij meer dan één avond. */
export function receptMeta(r: Recept, laatstGegeten: Record<string, string>, nu: Date, eters: number, avonden: number): string {
  return [
    r.soort !== 'avondeten' && r.soort,
    r.tijdMinuten > 0 && `${r.tijdMinuten} min`,
    avonden > 1 && `${aantalPorties(eters, avonden)} porties`,
    geledenTekst(laatstGegeten[r.id], nu),
  ].filter(Boolean).join(' · ')
}

export function Menu({ data, repo, naam, herlaad, bijgewerkt, nu = () => new Date() }: SchermProps & { nu?: () => Date }) {
  const menuNu = data.menu
  const menu: MenuT | null = menuNu?.menu ?? null
  const concept = useConcept(data, menu)
  const { gerechten } = concept
  const perId = useMemo(() => Object.fromEntries(data.recepten.map((r) => [r.id, r])), [data.recepten])
  const laatstGegeten = menu?.laatstGegeten ?? {}
  const vastgezet = useMemo(() => new Map((menu?.gerechten ?? []).map((g) => [g.receptId, g])), [menu])
  const regels = boodschappenRegels(behoeften(gerechten, perId), data.verpakkingen)
  const standaard = data.instellingen.huishouden

  const [toevoegen, setToevoegen] = useState(false)
  const [leegVragen, setLeegVragen] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<Error | null>(null)
  const [verdwijnt, setVerdwijnt] = useState<Set<string>>(new Set())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const schrijf = async (m: MenuT, bericht: string) => {
    setBezig(true)
    setFout(null)
    try {
      const sha = await repo.zetMenu(m, menuNu?.sha ?? null, bericht)
      bijgewerkt({ menu: m, sha })
      return true
    } catch (e) {
      setFout(e as Error)
      return false
    } finally {
      setBezig(false)
    }
  }

  const zetVast = async () => {
    const m = vastzetten(menu, gerechten, regels, naam, nu())
    if (await schrijf(m, `Menu vastgezet door ${naam}`)) {
      concept.wis()
      herlaad()
    }
  }

  const maakLeeg = async () => {
    setLeegVragen(false)
    if (await schrijf(leegmaken(menu, naam, nu()), `Keep leeggemaakt door ${naam}`)) {
      concept.wis()
      herlaad()
    }
  }

  const wisselGegeten = async (r: Recept) => {
    setBezig(true)
    setFout(null)
    try {
      const nieuwst = (await repo.menu()) ?? menuNu
      if (!nieuwst) return
      const huidig = nieuwst.menu.gerechten.find((g) => g.receptId === r.id)
      const m = markeerGegeten(nieuwst.menu, r.id, !huidig?.gegetenOp, nu())
      const sha = await repo.zetMenu(m, nieuwst.sha, `${r.titel} gegeten — ${naam}`)
      bijgewerkt({ menu: m, sha })
    } catch (e) {
      setFout(e as Error)
    } finally {
      setBezig(false)
    }
  }

  const weggeveegd = useRef<Set<string>>(new Set())
  const nieuwVoorstel = () => {
    const anders = data.recepten.filter((r) => !weggeveegd.current.has(r.id))
    const bron = anders.length >= 3 ? anders : data.recepten
    concept.wijzig(stelVoor(bron, laatstGegeten, data.verpakkingen, standaard, zaadVoor(menu), nu()))
    weggeveegd.current = new Set()
  }

  const verwijder = (id: string) => {
    weggeveegd.current.add(id)
    setVerdwijnt((s) => new Set(s).add(id))
    timers.current.push(setTimeout(() => {
      concept.wijzig((huidig) => huidig.filter((g) => g.receptId !== id))
      setVerdwijnt((s) => { const n = new Set(s); n.delete(id); return n })
    }, UIT_MS))
  }

  const zet = (id: string, veld: 'eters' | 'avonden', n: number) =>
    concept.wijzig((huidig) => huidig.map((g) => (g.receptId === id ? { ...g, [veld]: Math.max(1, n) } : g)))

  // pull-to-refresh
  const trekStart = useRef<number | null>(null)
  const [trek, setTrek] = useState(0)
  const trekHandlers = {
    onTouchStart: (e: React.TouchEvent) => { trekStart.current = window.scrollY <= 0 ? e.touches[0].clientY : null },
    onTouchMove: (e: React.TouchEvent) => { if (trekStart.current !== null) setTrek(Math.max(0, Math.min(120, e.touches[0].clientY - trekStart.current))) },
    onTouchEnd: () => {
      if (trek > TREK_DREMPEL) herlaad()
      trekStart.current = null
      setTrek(0)
    },
  }

  // gegeten gerechten onderaan
  const getoond = [...gerechten].sort((a, b) => Number(!!vastgezet.get(a.receptId)?.gegetenOp) - Number(!!vastgezet.get(b.receptId)?.gegetenOp))
  const magVastzetten = gerechten.length > 0 || (menu?.gerechten.length ?? 0) > 0

  return (
    <div data-testid="menu" className="menu" {...trekHandlers}>
      <div className="trek" style={{ height: trek * 0.6, opacity: trek / TREK_DREMPEL }} aria-live="polite">
        {trek > 10 && <span>{trek > TREK_DREMPEL ? 'Loslaten om te verversen' : 'Trek om te verversen'}</span>}
      </div>

      <div className="menu-kop">
        <div className="eyebrow">ffsjeffe · menu</div>
        <a className="link-zacht" href="#/instellingen">instellingen</a>
      </div>
      <h1 className="kop">Wat eten we <em>deze keer?</em></h1>

      <div className="status zacht klein">
        {menu ? `Vastgezet door ${menu.door}` : 'Nog niet vastgezet'}
        {menu && concept.heeftConcept && ' · gewijzigd, nog niet vastgezet'}
      </div>
      <KeepStatusMelding key={menu?.vastgezetOp ?? 'geen'} repo={repo} vastgezetOp={menu?.vastgezetOp ?? null} begin={data.keepStatus} />

      {data.recepten.length === 0 ? (
        <p className="kaart">Nog geen recepten. Voeg ze toe in Obsidian in de map <code>recepten</code>.</p>
      ) : (
        <ul className="gerechten">
          {getoond.map((g) => (
            <GerechtKaart
              key={g.receptId}
              recept={perId[g.receptId]}
              eters={g.eters}
              avonden={g.avonden}
              meta={receptMeta(perId[g.receptId], laatstGegeten, nu(), g.eters, g.avonden)}
              gegetenOp={vastgezet.get(g.receptId)?.gegetenOp ?? null}
              kanGegeten={vastgezet.has(g.receptId)}
              nu={nu()}
              verdwijnt={verdwijnt.has(g.receptId)}
              bezig={bezig}
              verwijder={() => verwijder(g.receptId)}
              tip={vastgezet.get(g.receptId)?.gegetenOp ? null : pakOp(perId[g.receptId], g, data.verpakkingen)}
              pasTipToe={(t: PakOp) => concept.wijzig((huidig) => huidig.map((x) => (x.receptId === g.receptId ? { ...x, eters: t.eters, avonden: t.avonden } : x)))}
              zetEters={(n: number) => zet(g.receptId, 'eters', n)}
              zetAvonden={(n: number) => zet(g.receptId, 'avonden', n)}
              wisselGegeten={() => wisselGegeten(perId[g.receptId])}
            />
          ))}
        </ul>
      )}

      {gerechten.length === 0 && data.recepten.length > 0 && (
        <div className="leeg">
          <p className="zacht">Het menu is leeg.</p>
          <button className="knop" onClick={nieuwVoorstel}>Nieuw voorstel</button>
        </div>
      )}

      {data.recepten.length > 0 && (
        <div className="erbij-rij">
          <button className="erbij" onClick={() => setToevoegen(true)}>
            <span className="plus" aria-hidden="true">+</span> Gerecht erbij
          </button>
          <a className="alle-recepten" href="#/recepten">☰ Alle recepten</a>
        </div>
      )}

      <Boodschappen regels={regels} />

      {fout && (
        <div className="kaart foutblok">
          <p className="melding fout">{fout.message}</p>
          {fout instanceof VerouderdFout && <button className="knop" onClick={() => { setFout(null); herlaad() }}>Herladen</button>}
        </div>
      )}

      <div className="onderbalk">
        <button className="pil" onClick={zetVast} disabled={bezig || !magVastzetten}>
          {bezig ? 'Bezig…' : 'Op de boodschappenlijst'} <span className="pil-pijl" aria-hidden="true">→</span>
        </button>
        <button className="link-zacht" onClick={() => setLeegVragen(true)} disabled={bezig}>Keep leegmaken</button>
      </div>

      {toevoegen && (
        <Toevoegen
          opties={kandidaten(gerechten, data.recepten, laatstGegeten, data.verpakkingen, standaard, zaadVoor(menu), nu())}
          meta={(r) => receptMeta(r, laatstGegeten, nu(), standaard, r.avonden)}
          sluit={() => setToevoegen(false)}
          kies={(r) => {
            concept.wijzig((huidig) => huidig.some((g) => g.receptId === r.id) ? huidig : [...huidig, { receptId: r.id, eters: standaard, avonden: r.avonden, gegetenOp: null, vorigeKeer: null }])
            setToevoegen(false)
          }}
        />
      )}

      {leegVragen && (
        <div className="paneel-achtergrond" onClick={() => setLeegVragen(false)}>
          <div className="paneel" role="dialog" aria-label="Keep leegmaken" onClick={(e) => e.stopPropagation()}>
            <h2 className="kop-klein">Keep leegmaken?</h2>
            <p className="zacht">Alles van ffsjeffe gaat van de Keep-lijst (ook wat al is afgevinkt) en het menu wordt leeg. Wat jullie zelf op de lijst zetten, blijft staan.</p>
            <div className="knoppenrij">
              <button className="knop" onClick={() => setLeegVragen(false)}>Annuleren</button>
              <button className="knop gevaar" onClick={maakLeeg}>Leegmaken</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GerechtKaart(p: {
  recept: Recept; eters: number; avonden: number; meta: string; gegetenOp: string | null; kanGegeten: boolean; nu: Date
  tip: PakOp | null; pasTipToe: (t: PakOp) => void
  verdwijnt: boolean; bezig: boolean; verwijder: () => void; zetEters: (n: number) => void; zetAvonden: (n: number) => void; wisselGegeten: () => void
}) {
  const { recept: r } = p
  const [vraag, setVraag] = useState(false)
  return (
    <li data-testid="gerecht" className={`gerecht-rij${p.verdwijnt ? ' uit' : ''}${p.gegetenOp ? ' gegeten' : ''}`}>
      <div className={`kaart gerecht${vraag ? ' vraagt' : ''}`}>
        {vraag ? (
          <div className="bevestig" role="group" aria-label={`${r.titel} verwijderen?`}>
            <span>Verwijderen?</span>
            <div className="bevestig-knoppen">
              <button className="knop" onClick={() => setVraag(false)}>Annuleren</button>
              <button className="knop gevaar" onClick={() => { setVraag(false); p.verwijder() }}>Verwijder</button>
            </div>
          </div>
        ) : (
          <>
            <div className="gerecht-kop">
              <div className="gerecht-tekst">
                <a className="titel" href={`#/recept/${encodeURIComponent(r.id)}`}>{r.titel}</a>
                <div className="meta zacht">{p.gegetenOp ? `✓ gegeten ${geledenTekst(p.gegetenOp, p.nu)}` : p.meta}</div>
              </div>
              <button className="verwijder-knop" aria-label={`Verwijder ${r.titel}`} onClick={() => setVraag(true)}>×</button>
            </div>
            {p.tip && (
              <button className="pakop" onClick={() => p.pasTipToe(p.tip!)}>
                Pak {p.tip.naam} op: {p.tip.avonden !== p.avonden ? `${p.tip.avonden} avonden` : `${p.tip.eters} eters`} · {p.tip.porties} porties
              </button>
            )}
            <div className="gerecht-bediening">
              <Stapper naam="eters" icoon="👤" waarde={p.eters} wijzig={p.zetEters} klein />
              <Stapper naam="avonden" icoon="☾" waarde={p.avonden} wijzig={p.zetAvonden} klein />
              {p.kanGegeten && (
                <button className={`gegeten-knop${p.gegetenOp ? ' aan' : ''}`} aria-label={`${r.titel} gegeten`} aria-pressed={!!p.gegetenOp} onClick={p.wisselGegeten} disabled={p.bezig}>
                  ✓<span className="label"> Gegeten</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </li>
  )
}
