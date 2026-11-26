import { useEffect, useMemo, useState } from 'react'
import type { Menu as MenuT } from '../core/types'
import { DataRepo, TokenFout, type Verbinding } from '../data/github'
import { Instellingen } from './Instellingen'
import { bewaarVerbinding, leesVerbinding, type Opgeslagen } from './opslag'
import { useData, type AppData, type Repo } from './useData'
import { Achtergrond } from './Achtergrond'
import { Menu } from './Menu'
import { ReceptPagina } from './Recept'
import { Recepten } from './Recepten'
import { TimerBalk } from './TimerBalk'
import './stijl.css'

export function useHash(): string {
  const [hash, setHash] = useState(() => location.hash || '#/')
  useEffect(() => {
    const op = () => setHash(location.hash || '#/')
    window.addEventListener('hashchange', op)
    return () => window.removeEventListener('hashchange', op)
  }, [])
  return hash
}

export type SchermProps = { data: AppData; repo: Repo; naam: string; herlaad: () => void; bijgewerkt: (m: { menu: MenuT; sha: string }) => void; hash: string }

function Inhoud(p: SchermProps) {
  if (p.hash.startsWith('#/recept/')) {
    const id = decodeURIComponent(p.hash.slice('#/recept/'.length))
    const r = p.data.recepten.find((x) => x.id === id)
    return r ? <ReceptPagina key={r.id} recept={r} data={p.data} repo={p.repo} naam={p.naam} bijgewerkt={p.bijgewerkt} /> : (
      <p className="kaart">Recept niet gevonden. <a className="link-accent" href="#/">Terug naar het menu</a></p>
    )
  }
  if (p.hash === '#/recepten') return <Recepten {...p} />
  return <Menu {...p} />
}

export default function App({ maakRepo = (v: Verbinding) => new DataRepo(v), Scherm = Inhoud }: { maakRepo?: (v: Verbinding) => Repo; Scherm?: (p: SchermProps) => JSX.Element }) {
  const [verbinding, setVerbinding] = useState<Opgeslagen | null>(leesVerbinding)
  const hash = useHash()
  const repo = useMemo(
    () => (verbinding ? maakRepo({ owner: verbinding.owner, repo: verbinding.repo, token: verbinding.token }) : null),
    // maakRepo is in de praktijk constant; alleen een nieuwe verbinding maakt een nieuwe repo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verbinding],
  )
  const data = useData(repo)
  const tokenFout = data.status === 'fout' && data.fout instanceof TokenFout

  if (!verbinding || hash === '#/instellingen' || tokenFout) {
    return (
      <main className="pagina">
        <Achtergrond />
        <Instellingen
          huidig={verbinding}
          melding={tokenFout ? data.fout.message : undefined}
          opslaan={(v) => {
            bewaarVerbinding(v)
            setVerbinding(v)
            if (hash === '#/instellingen') location.hash = '#/'
          }}
        />
      </main>
    )
  }

  return (
    <main className="pagina">
      <Achtergrond />
      <TimerBalk hash={hash} />
      {data.status === 'laden' && <p className="zacht laden">Laden…</p>}
      {data.status === 'fout' && (
        <div className="kaart">
          <p className="melding fout">Laden mislukt: {data.fout.message}</p>
          <button className="knop" onClick={data.herlaad}>Opnieuw</button>
        </div>
      )}
      {data.status === 'klaar' && (
        <div data-testid="geladen">
          {data.data.fouten.length > 0 && (
            <ul className="melding waarschuwing">
              {data.data.fouten.map((f) => (
                <li key={f.pad}>Niet ingelezen: {f.pad} ({f.fout})</li>
              ))}
            </ul>
          )}
          <Scherm data={data.data} repo={repo!} naam={verbinding.naam} herlaad={data.herlaad} bijgewerkt={data.bijgewerkt} hash={hash} />
        </div>
      )}
    </main>
  )
}
