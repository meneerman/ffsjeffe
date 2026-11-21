import { useMemo, useState } from 'react'
import type { Recept, Soort } from '../core/types'
import type { SchermProps } from './App'
import { receptMeta } from './Menu'
import { useConcept } from './useConcept'

export const SOORT_NAAM: Record<Soort, string> = {
  avondeten: 'Avondeten', voorgerecht: 'Voorgerecht', lunch: 'Lunch', ontbijt: 'Ontbijt', toetje: 'Toetje', snack: 'Snack',
}
const VOLGORDE: Soort[] = ['avondeten', 'voorgerecht', 'lunch', 'ontbijt', 'toetje', 'snack']

/** Alle recepten, per soort, om er in één keer een aantal op het menu te zetten. */
export function Recepten({ data, repo, naam }: SchermProps) {
  const menu = data.menu?.menu ?? null
  const concept = useConcept(data, menu, repo, naam)
  const opMenu = new Set(concept.gerechten.map((g) => g.receptId))
  const [filter, setFilter] = useState<Soort | 'alles'>('alles')
  const [alleenVriezer, setAlleenVriezer] = useState(false)
  const [gekozen, setGekozen] = useState<Set<string>>(new Set())
  const standaard = data.instellingen.huishouden
  const nu = new Date()

  const groepen = useMemo(() => {
    const perSoort = new Map<Soort, Recept[]>()
    for (const r of [...data.recepten].sort((a, b) => a.titel.localeCompare(b.titel, 'nl'))) {
      perSoort.set(r.soort, [...(perSoort.get(r.soort) ?? []), r])
    }
    return VOLGORDE.filter((s) => perSoort.has(s)).map((s) => ({ soort: s, recepten: perSoort.get(s)! }))
  }, [data.recepten])

  const wissel = (id: string) => setGekozen((g) => { const n = new Set(g); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const zetOpMenu = () => {
    const volgorde = groepen.flatMap((g) => g.recepten).filter((r) => gekozen.has(r.id) && !opMenu.has(r.id))
    concept.wijzig((huidig) => [
      ...huidig,
      ...volgorde.filter((r) => !huidig.some((g) => g.receptId === r.id)).map((r) => ({ receptId: r.id, eters: standaard, avonden: r.avonden, gegetenOp: null, vorigeKeer: null })),
    ])
    location.hash = '#/'
  }

  const zichtbaar = groepen
    .filter((g) => filter === 'alles' || g.soort === filter)
    .map((g) => ({ ...g, recepten: g.recepten.filter((r) => !alleenVriezer || r.invriezen) }))
    .filter((g) => g.recepten.length > 0)
  const aantalVriezer = data.recepten.filter((r) => r.invriezen).length

  return (
    <div className="recepten">
      <a className="terug" href="#/">‹ Menu</a>
      <h1 className="kop">Alle <em>recepten</em></h1>

      <div className="filters" role="toolbar" aria-label="Filter op soort">
        <button className={`chip${filter === 'alles' ? ' accent' : ''}`} aria-pressed={filter === 'alles'} onClick={() => setFilter('alles')}>
          Alles ({data.recepten.length})
        </button>
        {groepen.map((g) => (
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

      {data.recepten.length > 0 && zichtbaar.length === 0 && <p className="zacht">Geen recepten met deze filters.</p>}

      {data.recepten.length === 0 && <p className="kaart">Nog geen recepten. Voeg ze toe in Obsidian in de map <code>recepten</code>.</p>}

      {zichtbaar.map((g) => (
        <section key={g.soort}>
          <h2 className="eyebrow sectie">{SOORT_NAAM[g.soort]}</h2>
          <ul className="vinklijst receptlijst">
            {g.recepten.map((r) => {
              const al = opMenu.has(r.id)
              const aan = al || gekozen.has(r.id)
              return (
                <li key={r.id} className={al ? 'op-menu' : ''}>
                  <label>
                    <input type="checkbox" checked={aan} disabled={al} onChange={() => wissel(r.id)} aria-label={r.titel} />
                    <span className="receptregel">
                      <span className="titel">{r.titel}</span>
                      <span className="zacht klein">{al ? 'op het menu' : receptMeta(r, menu?.laatstGegeten ?? {}, nu, standaard, r.avonden)}</span>
                    </span>
                  </label>
                  <a className="open" href={`#/recept/${encodeURIComponent(r.id)}`} aria-label={`Open ${r.titel}`}>›</a>
                </li>
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
