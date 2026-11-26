import { useEffect, useState } from 'react'
import type { Wijziging } from '../core/types'
import { VerouderdFout } from '../data/github'
import { lees, schrijf } from './opslag'
import type { Repo } from './useData'

const datum = (iso: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))

/** Notities om het recept later aan te passen; gedeeld via de data-repo. Wat je typt blijft staan tot het bewaard is. */
export function Wijzigingen({ receptId, repo, naam }: { receptId: string; repo: Repo; naam: string }) {
  const sleutel = `ffsjeffe.wijziging.${receptId}`
  const [tekst, setTekst] = useState(() => lees<string>(sleutel) ?? '')
  const [lijst, setLijst] = useState<Wijziging[]>([])
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    let actief = true
    repo.wijzigingen()
      .then((w) => actief && setLijst(w?.wijzigingen ?? []))
      .catch((e: Error) => actief && setFout(`Notities laden mislukt: ${e.message}`))
    return () => { actief = false }
  }, [repo])

  const typ = (t: string) => {
    setTekst(t)
    schrijf(sleutel, t || null)
  }

  /** Past `wijzig` toe op de nieuwste lijst; bij een botsing met de ander nog één keer. */
  const bewaar = async (wijzig: (l: Wijziging[]) => Wijziging[], bericht: string) => {
    setBezig(true)
    setFout(null)
    const poging = async () => {
      const nieuwst = await repo.wijzigingen()
      const nieuw = wijzig(nieuwst?.wijzigingen ?? [])
      await repo.zetWijzigingen(nieuw, nieuwst?.sha ?? null, bericht)
      return nieuw
    }
    try {
      setLijst(await poging().catch((e) => { if (e instanceof VerouderdFout) return poging(); throw e }))
      return true
    } catch (e) {
      setFout(`Niet bewaard: ${(e as Error).message}`)
      return false
    } finally {
      setBezig(false)
    }
  }

  const voegToe = async () => {
    const nu = new Date().toISOString()
    const w: Wijziging = { id: `${nu}-${Math.random().toString(36).slice(2, 6)}`, receptId, tekst: tekst.trim(), door: naam, op: nu, verwerktOp: null }
    if (await bewaar((l) => [...l, w], `Wijziging voor ${receptId} — ${naam}`)) typ('')
  }

  const open = lijst.filter((w) => w.receptId === receptId && !w.verwerktOp)

  return (
    <section className="wijzigingen">
      <div className="eyebrow sectie" id="kop-wijzigingen">Wijzigingen voor de volgende keer</div>
      {open.length > 0 && (
        <ul aria-labelledby="kop-wijzigingen">
          {open.map((w) => (
            <li key={w.id}>
              <div>
                <p>{w.tekst}</p>
                <span className="zacht klein">{w.door} · {datum(w.op)}</span>
              </div>
              <button className="verwijder-knop" disabled={bezig} aria-label={`Verwijder notitie: ${w.tekst}`}
                onClick={() => void bewaar((l) => l.filter((x) => x.id !== w.id), `Wijziging verwijderd bij ${receptId} — ${naam}`)}>×</button>
            </li>
          ))}
        </ul>
      )}
      <textarea rows={3} value={tekst} onChange={(e) => typ(e.target.value)} aria-label="Wat moet anders?" placeholder="Wat moet anders? Bijv. meer kip, minder zout…" />
      {fout && <p className="melding fout" role="alert">{fout}</p>}
      <div className="knoppenrij">
        <button className="knop primair" disabled={bezig || !tekst.trim()} onClick={() => void voegToe()}>{bezig ? 'Bewaren…' : 'Bewaar notitie'}</button>
      </div>
    </section>
  )
}
