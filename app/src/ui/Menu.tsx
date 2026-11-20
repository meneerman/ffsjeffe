import { useEffect, useMemo, useRef, useState } from 'react'
import { behoeften, boodschappenRegels } from '../core/boodschappen'
import { leegmaken, markeerGegeten, vastzetten, zaadVoor } from '../core/menu'
import type { Gerecht, Menu as MenuT, Recept } from '../core/types'
import { dagenGeleden, kandidaten, stelVoor } from '../core/voorstel'
import { VerouderdFout } from '../data/github'
import type { SchermProps } from './App'
import { Boodschappen } from './Boodschappen'
import { KeepStatusMelding } from './KeepStatus'
import { Toevoegen } from './Toevoegen'
import { useConcept } from './useConcept'

const UIT_MS = 420 // uitglijden + inklappen
const ONGEDAAN_MS = 5000
const TREK_DREMPEL = 70

function geledenTekst(datum: string | undefined, nu: Date): string {
  if (!datum) return 'nog nooit'
  const d = dagenGeleden(datum, nu)
  return d <= 0 ? 'vandaag' : d === 1 ? 'gisteren' : `${d} dagen geleden`
}

export function receptMeta(r: Recept, laatstGegeten: Record<string, string>, nu: Date): string {
  return [r.tijdMinuten > 0 && `${r.tijdMinuten} min`, r.avonden > 1 && `${r.avonden} avonden`, geledenTekst(laatstGegeten[r.id], nu)].filter(Boolean).join(' · ')
}

export function Menu({ data, repo, naam, herlaad, nu = () => new Date() }: SchermProps & { nu?: () => Date }) {
  const [menuNu, setMenuNu] = useState(data.menu)
  useEffect(() => {
    // een verversing met een even nieuw of nieuwer menu overnemen
    if (data.menu && (!menuNu || data.menu.menu.vastgezetOp >= menuNu.menu.vastgezetOp)) setMenuNu(data.menu)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.menu])

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
  const [verdwijnt, setVerdwijnt] = useState<string | null>(null)
  const [ongedaan, setOngedaan] = useState<{ g: Gerecht; index: number } | null>(null)
  const ongedaanTimer = useRef<ReturnType<typeof setTimeout>>()

  const schrijf = async (m: MenuT, bericht: string) => {
    setBezig(true)
    setFout(null)
    try {
      const sha = await repo.zetMenu(m, menuNu?.sha ?? null, bericht)
      setMenuNu({ menu: m, sha })
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
      setMenuNu({ menu: m, sha })
    } catch (e) {
      setFout(e as Error)
    } finally {
      setBezig(false)
    }
  }

  const verwijder = (id: string) => {
    const index = gerechten.findIndex((g) => g.receptId === id)
    if (index < 0) return
    setVerdwijnt(id)
    setTimeout(() => {
      concept.wijzig(gerechten.filter((g) => g.receptId !== id))
      setVerdwijnt(null)
      setOngedaan({ g: gerechten[index], index })
      clearTimeout(ongedaanTimer.current)
      ongedaanTimer.current = setTimeout(() => setOngedaan(null), ONGEDAAN_MS)
    }, UIT_MS)
  }

  const zetTerug = () => {
    if (!ongedaan) return
    const nieuw = [...gerechten]
    nieuw.splice(Math.min(ongedaan.index, nieuw.length), 0, ongedaan.g)
    concept.wijzig(nieuw)
    setOngedaan(null)
  }

  const zetEters = (id: string, eters: number) => concept.wijzig(gerechten.map((g) => (g.receptId === id ? { ...g, eters: Math.max(1, eters) } : g)))

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

      <div className="eyebrow">ffsjeffe · menu</div>
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
              meta={receptMeta(perId[g.receptId], laatstGegeten, nu())}
              gegetenOp={vastgezet.get(g.receptId)?.gegetenOp ?? null}
              kanGegeten={vastgezet.has(g.receptId)}
              nu={nu()}
              verdwijnt={verdwijnt === g.receptId}
              bezig={bezig}
              verwijder={() => verwijder(g.receptId)}
              wijzigEters={(d: number) => zetEters(g.receptId, g.eters + d)}
              wisselGegeten={() => wisselGegeten(perId[g.receptId])}
            />
          ))}
        </ul>
      )}

      {gerechten.length === 0 && data.recepten.length > 0 && (
        <div className="leeg">
          <p className="zacht">Het menu is leeg.</p>
          <button className="knop" onClick={() => concept.wijzig(stelVoor(data.recepten, laatstGegeten, data.verpakkingen, standaard, zaadVoor(menu), nu()))}>Nieuw voorstel</button>
        </div>
      )}

      {data.recepten.length > 0 && (
        <button className="erbij" onClick={() => setToevoegen(true)}>
          <span className="plus" aria-hidden="true">+</span> Gerecht erbij
        </button>
      )}

      <Boodschappen regels={regels} />

      {fout && (
        <div className="kaart foutblok">
          <p className="melding fout">{fout.message}</p>
          {fout instanceof VerouderdFout && <button className="knop" onClick={() => { setFout(null); herlaad() }}>Herladen</button>}
        </div>
      )}

      <div className="onderbalk">
        {ongedaan && (
          <div className="toast" role="status">
            <span>{perId[ongedaan.g.receptId]?.titel} verwijderd</span>
            <button className="link-accent" onClick={zetTerug}>Ongedaan maken</button>
          </div>
        )}
        <button className="pil" onClick={zetVast} disabled={bezig || !magVastzetten}>
          {bezig ? 'Bezig…' : 'Op de boodschappenlijst'} <span className="pil-pijl" aria-hidden="true">→</span>
        </button>
        <button className="link-zacht" onClick={() => setLeegVragen(true)} disabled={bezig}>Keep leegmaken</button>
      </div>

      {toevoegen && (
        <Toevoegen
          opties={kandidaten(gerechten, data.recepten, laatstGegeten, data.verpakkingen, standaard, zaadVoor(menu), nu())}
          meta={(r) => receptMeta(r, laatstGegeten, nu())}
          sluit={() => setToevoegen(false)}
          kies={(r) => {
            concept.wijzig([...gerechten, { receptId: r.id, eters: standaard, gegetenOp: null, vorigeKeer: null }])
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
  recept: Recept; eters: number; meta: string; gegetenOp: string | null; kanGegeten: boolean; nu: Date
  verdwijnt: boolean; bezig: boolean; verwijder: () => void; wijzigEters: (d: number) => void; wisselGegeten: () => void
}) {
  const { recept: r } = p
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; y: number; breedte: number } | null>(null)
  const horizontaal = useRef(false)

  const los = () => {
    if (!start.current) return
    const voorbij = -dx > start.current.breedte * 0.35
    start.current = null
    horizontaal.current = false
    if (voorbij) p.verwijder()
    else setDx(0)
  }

  const uit = p.verdwijnt
  return (
    <li data-testid="gerecht" className={`gerecht-rij${uit ? ' uit' : ''}${p.gegetenOp ? ' gegeten' : ''}`}>
      <div className="veeg-achter" aria-hidden="true">Verwijder</div>
      <div
        className="kaart gerecht"
        style={{ transform: `translateX(${uit ? '-110%' : `${dx}px`})`, transition: start.current ? 'none' : 'transform .25s var(--veer)' }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button, a')) return
          start.current = { x: e.clientX, y: e.clientY, breedte: e.currentTarget.offsetWidth || 300 }
        }}
        onPointerMove={(e) => {
          if (!start.current) return
          const ddx = e.clientX - start.current.x
          if (!horizontaal.current && Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(e.clientY - start.current.y)) horizontaal.current = true
          if (horizontaal.current) setDx(Math.min(0, ddx))
        }}
        onPointerUp={los}
        onPointerCancel={los}
      >
        <div className="gerecht-tekst">
          <a className="titel" href={`#/recept/${encodeURIComponent(r.id)}`}>{r.titel}</a>
          <div className="meta zacht">{p.gegetenOp ? `✓ gegeten ${geledenTekst(p.gegetenOp, p.nu) === 'vandaag' ? 'vandaag' : geledenTekst(p.gegetenOp, p.nu)}` : p.meta}</div>
        </div>
        <div className="gerecht-acties">
          <div className="eters" role="group" aria-label="aantal eters">
            <button aria-label="Minder eters" onClick={() => p.wijzigEters(-1)} disabled={p.eters <= 1}>−</button>
            <span aria-label="eters">{p.eters}</span>
            <button aria-label="Meer eters" onClick={() => p.wijzigEters(1)}>+</button>
          </div>
          {p.kanGegeten && (
            <button className={`gegeten-knop${p.gegetenOp ? ' aan' : ''}`} aria-label={`${r.titel} gegeten`} aria-pressed={!!p.gegetenOp} onClick={p.wisselGegeten} disabled={p.bezig}>
              ✓<span className="label"> Gegeten</span>
            </button>
          )}
          <button className="verwijder-knop" aria-label={`Verwijder ${r.titel}`} onClick={p.verwijder}>×</button>
        </div>
      </div>
    </li>
  )
}
