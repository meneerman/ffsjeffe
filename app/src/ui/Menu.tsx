import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { behoeften, boodschappenItems } from '../core/boodschappen'
import { laatsteVastgezetOp, leegmaken, markeerGegeten, vastzetten, zaadVoor } from '../core/menu'
import type { Menu as MenuT, Recept } from '../core/types'
import { pakOp, type PakOp } from '../core/pakop'
import { aantalPorties } from '../core/schalen'
import { kandidaten } from '../core/voorstel'
import { VerouderdFout } from '../data/github'
import type { SchermProps } from './App'
import { Bereiden, geledenTekst } from './Bereiden'
import { NaLopen } from './NaLopen'
import { Venster } from './Venster'
import { leesModus, schrijfModus, type Modus } from './modus'
import { ReceptWinkelbordjes } from './Winkel'
import type { Winkels } from '../core/winkels'
import { druk, lijstItem, snel } from './beweging'
import { KeepStatusMelding } from './KeepStatus'
import { Toevoegen } from './Toevoegen'
import { Stapper } from './Stapper'
import { useConcept } from './useConcept'

const TREK_DREMPEL = 70

/** "25 min · 12 porties · 18 dagen geleden"; porties alleen bij meer dan één avond. */
export function receptMeta(r: Recept, laatstGegeten: Record<string, string>, nu: Date, eters: number, avonden: number): string {
  return [
    r.soort !== 'avondeten' && r.soort,
    r.tijdMinuten > 0 && `${r.tijdMinuten} min`,
    r.vooraf && `⏳ ${r.vooraf}`,
    avonden > 1 && `${aantalPorties(eters, avonden)} porties`,
    geledenTekst(laatstGegeten[r.id], nu),
    r.invriezen && '❄ invriesbaar',
  ].filter(Boolean).join(' · ')
}

export function Menu({ data, repo, naam, herlaad, bijgewerkt, nu = () => new Date(), bewaarVertraging }: SchermProps & { nu?: () => Date; bewaarVertraging?: number }) {
  const menuNu = data.menu
  const menu: MenuT | null = menuNu?.menu ?? null
  const concept = useConcept(data, menu, repo, naam, bewaarVertraging)
  const { gerechten } = concept
  const laatsteLijst = useRef(gerechten)
  laatsteLijst.current = gerechten
  const perId = useMemo(() => Object.fromEntries(data.recepten.map((r) => [r.id, r])), [data.recepten])
  const laatstGegeten = menu?.laatstGegeten ?? {}
  // Plannen staat los van wat al besteld is: de boodschappen komen alleen uit de gerechten van het concept
  const items = boodschappenItems(behoeften(gerechten, perId), data.verpakkingen)
  const nieuweItems = gerechten.length === 0 ? [] : items
  // wat je uitvinkt gaat deze ronde niet naar Keep; alleen op dit toestel, tot het vastzetten
  const [uit, setUit] = useState<Set<string>>(new Set())
  const wisselRegel = (regel: string) => setUit((u) => {
    const n = new Set(u)
    if (!n.delete(regel)) n.add(regel)
    return n
  })
  const regels = nieuweItems.filter((i) => !uit.has(i.regel)).map((i) => i.regel)
  const standaard = data.instellingen.huishouden

  const [toevoegen, setToevoegen] = useState(false)
  const [leegVragen, setLeegVragen] = useState(false)
  const [bevestigVast, setBevestigVast] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<Error | null>(null)

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
      kiesModus('bereiden')
      setUit(new Set())
      concept.wis()
      herlaad()
    }
  }

  const maakLeeg = async () => {
    setLeegVragen(false)
    if (await schrijf(leegmaken(menu, nu()), `Keep leeggemaakt door ${naam}`)) {
      concept.wis()
      herlaad()
    }
  }

  const zetGegeten = async (batchId: string, r: Recept, gegeten: boolean, beoordeling: number | null) => {
    setBezig(true)
    setFout(null)
    try {
      const nieuwst = (await repo.menu()) ?? menuNu
      if (!nieuwst) return
      const m = markeerGegeten(nieuwst.menu, batchId, r.id, gegeten, beoordeling, nu())
      const sha = await repo.zetMenu(m, nieuwst.sha, `${r.titel} ${gegeten ? 'gegeten' : 'niet gegeten'} — ${naam}`)
      bijgewerkt({ menu: m, sha })
    } catch (e) {
      setFout(e as Error)
    } finally {
      setBezig(false)
    }
  }

  const verwijder = (id: string) => {
    concept.wijzig((huidig) => huidig.filter((g) => g.receptId !== id))
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
  const getoond = gerechten
  // Bereiden: het vastgezette menu, de boodschappen zijn gedaan. Plannen: het concept voor de volgende keer.
  const [modus, setModus] = useState<Modus | null>(leesModus)
  const kiesModus = (m: Modus) => { setModus(m); schrijfModus(m) }
  const kanBereiden = !!menu && menu.batches.some((b) => b.gerechten.length > 0)
  const bereiden = kanBereiden && (modus ?? (concept.heeftConcept ? 'plannen' : 'bereiden')) === 'bereiden'
  const [teVerwijderen, setTeVerwijderen] = useState<string | null>(null)
  // tijdens het wegglijden van het venster blijft de laatst gevraagde titel staan
  const laatstGevraagd = useRef<string | null>(null)
  if (teVerwijderen) laatstGevraagd.current = teVerwijderen
  const vraagId = teVerwijderen ?? laatstGevraagd.current
  const magVastzetten = gerechten.length > 0

  return (
    <div data-testid="menu" className="menu" {...trekHandlers}>
      <div className="trek" style={{ height: trek * 0.6, opacity: trek / TREK_DREMPEL }} aria-live="polite">
        {trek > 10 && <span>{trek > TREK_DREMPEL ? 'Loslaten om te verversen' : 'Trek om te verversen'}</span>}
      </div>

      <div className="menu-kop">
        <h1 className="kop kop-merk">ff<em>sjeffe</em></h1>
        <a className="tandwiel" href="#/instellingen" aria-label="Instellingen">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5h0a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
          </svg>
        </a>
      </div>
      <p className="kop-sub">{bereiden ? 'Wat we bereiden' : 'Wat eten we deze keer?'}</p>
      {kanBereiden && (
        <div className="modus" role="tablist" aria-label="Modus">
          <motion.button whileTap={druk} role="tab" aria-selected={!bereiden} className={!bereiden ? 'aan' : ''} onClick={() => kiesModus('plannen')}>
            {!bereiden && <motion.span layoutId="modus-blok" className="modus-blok" aria-hidden="true" transition={snel} />}<span>Plannen</span>
          </motion.button>
          <motion.button whileTap={druk} role="tab" aria-selected={bereiden} className={bereiden ? 'aan' : ''} onClick={() => kiesModus('bereiden')}>
            {bereiden && <motion.span layoutId="modus-blok" className="modus-blok" aria-hidden="true" transition={snel} />}<span>Bereiden</span>
          </motion.button>
        </div>
      )}

      <div className="status zacht klein">
        {menu && menu.batches.length > 0 ? `Vastgezet door ${menu.batches[menu.batches.length - 1].door}` : 'Nog niet vastgezet'}
      </div>
      {!bereiden && concept.heeftConcept && (
        <div className="status concept-status zacht klein" role="status">
          <span>Concept van {concept.door ?? 'iemand'}, nog niet op Keep</span>
          {concept.opslag.status === 'bezig' && <span> · bewaren…</span>}
          {concept.opslag.status === 'bewaard' && <span className="bewaard"> · ✓ bewaard</span>}
          {concept.opslag.status === 'mislukt' && (
            <>
              <span className="melding fout"> · Bewaren mislukt</span>{' '}
              <button className="link-zacht" onClick={concept.bewaarOpnieuw}>Opnieuw bewaren</button>
            </>
          )}
        </div>
      )}
      {/* alleen in Bereiden, en alleen als er echt iets van ffsjeffe in Keep hoort te staan */}
      {bereiden && menu && menu.batches.some((b) => b.gerechten.length > 0 && b.boodschappen.length > 0) && (
        <KeepStatusMelding key={laatsteVastgezetOp(menu)} repo={repo} vastgezetOp={laatsteVastgezetOp(menu)} begin={data.keepStatus} />
      )}
      {bereiden && concept.heeftConcept && (
        <div className="status concept-status zacht klein">Concept van {concept.door ?? 'iemand'} ligt klaar voor de volgende boodschappen (tab Plannen).</div>
      )}

      {bereiden && menu ? (
        <Bereiden menu={menu} perId={perId} nu={nu()} bezig={bezig} zetGegeten={zetGegeten} winkels={data.winkels} />
      ) : data.recepten.length === 0 ? (
        <p className="kaart">Nog geen recepten. Voeg ze toe in Obsidian in de map <code>recepten</code>.</p>
      ) : (
        <ul className="gerechten">
          <AnimatePresence initial={false}>
          {getoond.map((g) => (
            <GerechtKaart
              key={g.receptId}
              recept={perId[g.receptId]}
              winkels={data.winkels}
              eters={g.eters}
              avonden={g.avonden}
              meta={receptMeta(perId[g.receptId], laatstGegeten, nu(), g.eters, g.avonden)}
              nu={nu()}
              bezig={bezig}
              vraagVerwijder={() => setTeVerwijderen(g.receptId)}
              tip={pakOp(perId[g.receptId], g, data.verpakkingen)}
              pasTipToe={(t: PakOp) => concept.wijzig((huidig) => huidig.map((x) => (x.receptId === g.receptId ? { ...x, eters: t.eters, avonden: t.avonden } : x)))}
              zetEters={(n: number) => zet(g.receptId, 'eters', n)}
              zetAvonden={(n: number) => zet(g.receptId, 'avonden', n)}
            />
          ))}
          </AnimatePresence>
        </ul>
      )}

      {!bereiden && gerechten.length === 0 && data.recepten.length > 0 && (
        <p className="leeg zacht">Nog niets gepland</p>
      )}

      {!bereiden && data.recepten.length > 0 && (
        <div className="erbij-blok">
          <motion.button whileTap={druk} className="erbij" onClick={() => setToevoegen(true)}>
            <span className="plus" aria-hidden="true">+</span> Gerecht erbij
          </motion.button>
          <motion.a whileTap={druk} className="chip alle-recepten" href="#/recepten">☰ Alle recepten</motion.a>
        </div>
      )}

      {!bereiden && <NaLopen items={nieuweItems} categorieen={data.categorieen} winkels={data.winkels} uit={uit} onWissel={wisselRegel} />}

      {fout && (
        <div className="kaart foutblok">
          <p className="melding fout">{fout.message}</p>
          {fout instanceof VerouderdFout && <button className="knop" onClick={() => { setFout(null); herlaad() }}>Herladen</button>}
        </div>
      )}

      {/* Keep leegmaken sluit een ronde af: zelden nodig, dus klein onderaan Bereiden */}
      {bereiden && (
        <div className="ronde-klaar">
          <button className="link-zacht" onClick={() => setLeegVragen(true)} disabled={bezig}>Ronde klaar? Keep leegmaken</button>
        </div>
      )}

      {!bereiden && (
        <div className="onderbalk">
          <button className="pil" onClick={() => setBevestigVast(true)} disabled={bezig || !magVastzetten}>
            {bezig ? 'Bezig…' : 'Op de boodschappenlijst'} <span className="pil-pijl" aria-hidden="true">→</span>
          </button>
        </div>
      )}

      <AnimatePresence>
      {toevoegen && (
        <Toevoegen
          opties={kandidaten(gerechten, data.recepten, laatstGegeten, data.verpakkingen, standaard, zaadVoor(menu), nu())}
          meta={(r) => receptMeta(r, laatstGegeten, nu(), standaard, r.avonden)}
          sluit={() => setToevoegen(false)}
          winkels={data.winkels}
          kies={(r) => {
            concept.wijzig((huidig) => huidig.some((g) => g.receptId === r.id) ? huidig : [...huidig, { receptId: r.id, eters: standaard, avonden: r.avonden, gegetenOp: null, vorigeKeer: null }])
            setToevoegen(false)
          }}
        />
      )}
      </AnimatePresence>

      <Venster open={!!teVerwijderen && !!perId[teVerwijderen]} sluit={() => setTeVerwijderen(null)} label="Weet je het zeker?">
            <h2 className="kop-klein">Weet je het zeker?</h2>
            <p className="zacht">{vraagId && perId[vraagId]?.titel} gaat van het menu af.</p>
            <div className="knoppenrij">
              <button className="knop" onClick={() => setTeVerwijderen(null)}>Annuleren</button>
              <button className="knop gevaar" onClick={() => { const id = teVerwijderen; setTeVerwijderen(null); if (id) verwijder(id) }}>Verwijderen</button>
            </div>
      </Venster>

      <Venster open={bevestigVast} sluit={() => setBevestigVast(false)} label="Naar Keep sturen" ruim>
            <h2 className="kop-klein">Weet je het zeker?</h2>
            <p className="zacht">Dit gaat naar Keep. Vink nog uit wat je al in huis hebt.</p>
            <NaLopen items={nieuweItems} categorieen={data.categorieen} winkels={data.winkels} uit={uit} onWissel={wisselRegel} />
            <div className="knoppenrij">
              <button className="knop" onClick={() => setBevestigVast(false)}>Annuleren</button>
              <button className="knop primair" disabled={bezig} onClick={() => { setBevestigVast(false); void zetVast() }}>Ja, naar Keep</button>
            </div>
      </Venster>

      <Venster open={leegVragen} sluit={() => setLeegVragen(false)} label="Keep leegmaken">
            <h2 className="kop-klein">Keep leegmaken?</h2>
            <p className="zacht">Alles van ffsjeffe gaat van de Keep-lijst (ook wat al is afgevinkt) en het menu wordt leeg. Wat jullie zelf op de lijst zetten, blijft staan.</p>
            <div className="knoppenrij">
              <button className="knop" onClick={() => setLeegVragen(false)}>Annuleren</button>
              <button className="knop gevaar" onClick={maakLeeg}>Leegmaken</button>
            </div>
      </Venster>
    </div>
  )
}

function GerechtKaart(p: {
  winkels: Winkels
  recept: Recept; eters: number; avonden: number; meta: string; nu: Date
  tip: PakOp | null; pasTipToe: (t: PakOp) => void
  bezig: boolean; vraagVerwijder: () => void; zetEters: (n: number) => void; zetAvonden: (n: number) => void
}) {
  const { recept: r } = p
  return (
    <motion.li layout variants={lijstItem} initial="verborgen" animate="zichtbaar" exit="weg" data-testid="gerecht" className="gerecht-rij">
      <div className="kaart gerecht">
        <div className="gerecht-kop">
          <div className="gerecht-tekst">
            <a className="titel" href={`#/recept/${encodeURIComponent(r.id)}`}>{r.titel}</a>
            <ReceptWinkelbordjes recept={r} winkels={p.winkels} />
            <div className="meta zacht">{p.meta}</div>
          </div>
          <button className="verwijder-knop" aria-label={`Verwijder ${r.titel}`} onClick={p.vraagVerwijder}>×</button>
        </div>
        {p.tip && (
          <button className="pakop" onClick={() => p.pasTipToe(p.tip!)}>
            Pak {p.tip.naam} op: {p.tip.avonden !== p.avonden ? `${p.tip.avonden} avonden` : `${p.tip.eters} eters`} · {p.tip.porties} porties
          </button>
        )}
        <div className="gerecht-bediening">
          <Stapper naam="eters" icoon="👤" waarde={p.eters} wijzig={p.zetEters} klein />
          <Stapper naam="avonden" icoon="☾" waarde={p.avonden} wijzig={p.zetAvonden} klein />
        </div>
      </div>
    </motion.li>
  )
}
