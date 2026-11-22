import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { zoekRecepten } from '../core/zoeken'
import type { Recept, Soort } from '../core/types'
import type { SchermProps } from './App'
import { receptMeta } from './Menu'
import { druk, lijstItem } from './beweging'
import { useConcept } from './useConcept'

export const SOORT_NAAM: Record<Soort, string> = {
  avondeten: 'Avondeten', voorgerecht: 'Voorgerecht', lunch: 'Lunch', ontbijt: 'Ontbijt', toetje: 'Toetje', snack: 'Snack',
}
const VOLGORDE: Soort[] = ['avondeten', 'voorgerecht', 'lunch', 'ontbijt', 'toetje', 'snack']

const ZOEK_SLEUTEL = 'ffsjeffe.zoek'
// de zoekopdracht blijft staan als je een recept opent en terugkomt, maar niet tot de volgende keer dat je de app opent
const leesZoek = () => { try { return sessionStorage.getItem(ZOEK_SLEUTEL) ?? '' } catch { return '' } }
const schrijfZoek = (t: string) => { try { sessionStorage.setItem(ZOEK_SLEUTEL, t) } catch { /* zonder opslag werkt zoeken gewoon */ } }

function indelen(recepten: Recept[]) {
  const perSoort = new Map<Soort, Recept[]>()
  for (const r of [...recepten].sort((a, b) => a.titel.localeCompare(b.titel, 'nl'))) {
    perSoort.set(r.soort, [...(perSoort.get(r.soort) ?? []), r])
  }
  return VOLGORDE.filter((sd) => perSoort.has(sd)).map((sd) => ({ soort: sd, recepten: perSoort.get(sd)! }))
}

/** Alle recepten, per soort, om er in één keer een aantal op het menu te zetten. */
export function Recepten({ data, repo, naam }: SchermProps) {
  const menu = data.menu?.menu ?? null
  const concept = useConcept(data, menu, repo, naam)
  const opMenu = new Set([...(menu?.gerechten ?? []), ...concept.gerechten].map((g) => g.receptId))
  const [filter, setFilter] = useState<Soort | 'alles'>('alles')
  const [alleenVriezer, setAlleenVriezer] = useState(false)
  const [gekozen, setGekozen] = useState<Set<string>>(new Set())
  const standaard = data.instellingen.huishouden
  const nu = new Date()

  const [zoek, setZoek] = useState(leesZoek)
  useEffect(() => schrijfZoek(zoek), [zoek])

  // alle recepten, voor de volgorde waarin gekozen recepten op het menu komen (los van wat je nu ziet)
  const groepen = useMemo(() => indelen(data.recepten), [data.recepten])
  const treffers = useMemo(() => zoekRecepten(data.recepten, zoek), [data.recepten, zoek])
  const treffersPerId = useMemo(() => new Map((treffers ?? []).map((t) => [t.recept.id, t.treffers])), [treffers])
  // wat je nu kunt kiezen: alles, of alleen wat bij de zoekopdracht past (filters en tellers volgen die lijst)
  const basis = treffers ? treffers.map((t) => t.recept) : data.recepten
  const groepenZicht = useMemo(() => indelen(basis), [basis])

  const wissel = (id: string) => setGekozen((g) => { const n = new Set(g); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const zetOpMenu = () => {
    const volgorde = groepen.flatMap((g) => g.recepten).filter((r) => gekozen.has(r.id) && !opMenu.has(r.id))
    concept.wijzig((huidig) => [
      ...huidig,
      ...volgorde.filter((r) => !huidig.some((g) => g.receptId === r.id)).map((r) => ({ receptId: r.id, eters: standaard, avonden: r.avonden, gegetenOp: null, vorigeKeer: null })),
    ])
    location.hash = '#/'
  }

  const zichtbaar = groepenZicht
    .filter((g) => filter === 'alles' || g.soort === filter)
    .map((g) => ({ ...g, recepten: g.recepten.filter((r) => !alleenVriezer || r.invriezen) }))
    .filter((g) => g.recepten.length > 0)
  const aantalVriezer = basis.filter((r) => r.invriezen).length

  return (
    <div className="recepten">
      <a className="terug" href="#/">‹ Menu</a>
      <h1 className="kop">Alle <em>recepten</em></h1>

      <div className="zoekbalk" role="search">
        <svg className="zoek-icoon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" />
        </svg>
        <input
          type="search"
          aria-label="Zoek op ingrediënt"
          placeholder="Zoek op ingrediënt, bijv. broccoli"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        {zoek && (
          <motion.button whileTap={druk} className="zoek-wis" aria-label="Zoekopdracht wissen" onClick={() => setZoek('')}>×</motion.button>
        )}
      </div>
      {treffers && (
        <p className="zoek-stand zacht klein" aria-live="polite">
          {treffers.length} van {data.recepten.length} recepten met {zoek.trim()}
        </p>
      )}

      <div className="filters" role="toolbar" aria-label="Filter op soort">
        <button className={`chip${filter === 'alles' ? ' accent' : ''}`} aria-pressed={filter === 'alles'} onClick={() => setFilter('alles')}>
          Alles ({basis.length})
        </button>
        {groepenZicht.map((g) => (
          <button key={g.soort} className={`chip${filter === g.soort ? ' accent' : ''}`} aria-pressed={filter === g.soort} onClick={() => setFilter(g.soort)}>
            {SOORT_NAAM[g.soort]} ({g.recepten.length})
          </button>
        ))}
        {aantalVriezer > 0 && (
          <button className={`chip vries${alleenVriezer ? ' accent' : ''}`} aria-pressed={alleenVriezer} onClick={() => setAlleenVriezer((v) => !v)}>
            ❄ Invriesbaar ({aantalVriezer})
          </button>
        )}
      </div>

      {data.recepten.length > 0 && zichtbaar.length === 0 && (
        treffers && treffers.length === 0 ? (
          <div className="zoek-leeg">
            <p className="zacht">Geen recepten met "{zoek.trim()}".</p>
            <button className="knop" onClick={() => setZoek('')}>Alles tonen</button>
          </div>
        ) : <p className="zacht">Geen recepten met deze filters.</p>
      )}

      {data.recepten.length === 0 && <p className="kaart">Nog geen recepten. Voeg ze toe in Obsidian in de map <code>recepten</code>.</p>}

      {zichtbaar.map((g) => (
        <section key={g.soort}>
          <h2 className="eyebrow sectie">{SOORT_NAAM[g.soort]}</h2>
          <ul className="vinklijst receptlijst">
            {g.recepten.map((r) => {
              const al = opMenu.has(r.id)
              const aan = al || gekozen.has(r.id)
              return (
                <motion.li key={r.id} layout variants={lijstItem} initial={false} animate="zichtbaar" className={al ? 'op-menu' : ''}>
                  <label>
                    <input type="checkbox" checked={aan} disabled={al} onChange={() => wissel(r.id)} aria-label={r.titel} />
                    <span className="receptregel">
                      <span className="titel">{r.titel}</span>
                      <span className="zacht klein">{al ? 'op het menu' : receptMeta(r, menu?.laatstGegeten ?? {}, nu, standaard, r.avonden)}</span>
                      {(treffersPerId.get(r.id)?.length ?? 0) > 0 && <span className="gevonden klein">met {treffersPerId.get(r.id)!.join(', ')}</span>}
                    </span>
                  </label>
                  <a className="open" href={`#/recept/${encodeURIComponent(r.id)}`} aria-label={`Open ${r.titel}`}>›</a>
                </motion.li>
              )
            })}
          </ul>
        </section>
      ))}

      <div className="onderbalk">
        <button className="pil" onClick={zetOpMenu} disabled={gekozen.size === 0}>
          Op het menu{gekozen.size > 0 ? ` (${gekozen.size})` : ''} <span className="pil-pijl" aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  )
}
