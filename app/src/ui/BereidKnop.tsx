import { useState } from 'react'
import { datumNL, gerechtVoorRecept, markeerBereid } from '../core/menu'
import type { Menu, Recept } from '../core/types'
import { VerouderdFout } from '../data/github'
import { Beoordeel, type Vraag } from './Beoordeel'
import type { AppData, Repo } from './useData'

type Props = { recept: Recept; data: AppData; repo: Repo; naam: string; bijgewerkt?: (m: { menu: Menu; sha: string }) => void; nu?: () => Date }

/** Onderaan het recept: in één keer sterren geven en afvinken. */
export function BereidKnop({ recept: r, data, repo, naam, bijgewerkt, nu = () => new Date() }: Props) {
  // zolang de app niet ververst is, onthoudt de knop zelf wat er net geschreven is
  const [geschreven, setGeschreven] = useState<Menu | null>(null)
  const menu = geschreven ?? data.menu?.menu ?? null
  const open = gerechtVoorRecept(menu, r.id)
  const klaar = menu?.laatstGegeten[r.id] === datumNL(nu()) && !(open && !open.gerecht.gegetenOp)
  const [vraag, setVraag] = useState<Vraag | null>(null)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<Error | null>(null)

  const bewaar = async (sterren: number | null) => {
    setVraag(null)
    setBezig(true)
    setFout(null)
    try {
      const poging = async () => {
        const nieuwst = await repo.menu()
        const m = markeerBereid(nieuwst?.menu ?? null, r.id, sterren, nu())
        const sha = await repo.zetMenu(m, nieuwst?.sha ?? null, `${r.titel} gegeten — ${naam}`)
        return { menu: m, sha }
      }
      // de ander schreef er net tussendoor: nog één keer op de nieuwste stand
      const nieuw = await poging().catch((e) => { if (e instanceof VerouderdFout) return poging(); throw e })
      setGeschreven(nieuw.menu)
      bijgewerkt?.(nieuw)
    } catch (e) {
      setFout(e as Error)
    } finally {
      setBezig(false)
    }
  }

  return (
    <div className="bereid-blok">
      <button className={`pil bereid-knop${klaar ? ' klaar' : ''}`} disabled={bezig} onClick={() => setVraag({ titel: r.titel, begin: menu?.beoordelingen[r.id] ?? null })}>
        {bezig ? 'Bewaren…' : klaar ? '✓ Vandaag gegeten · sterren aanpassen' : 'Bereid en gegeten'}
      </button>
      {fout && <p className="melding fout" role="alert">Niet bewaard: {fout.message}</p>}
      <Beoordeel vraag={vraag} bezig={bezig} sluit={() => setVraag(null)} bevestig={(s) => void bewaar(s)} />
    </div>
  )
}
