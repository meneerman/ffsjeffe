import { useState } from 'react'
import { STANDAARD_REPO } from '../data/github'
import type { Opgeslagen } from './opslag'

export function Instellingen({ huidig, melding, opslaan }: { huidig: Opgeslagen | null; melding?: string; opslaan: (v: Opgeslagen) => void }) {
  const [naam, setNaam] = useState(huidig?.naam ?? '')
  const [token, setToken] = useState('')
  const [fout, setFout] = useState('')

  return (
    <form
      className="instellingen"
      onSubmit={(e) => {
        e.preventDefault()
        if (!naam.trim() || !(token.trim() || huidig?.token)) return setFout('Vul je naam en een token in.')
        opslaan({ ...STANDAARD_REPO, ...(huidig ? { owner: huidig.owner, repo: huidig.repo } : {}), naam: naam.trim(), token: token.trim() || huidig!.token })
      }}
    >
      <div className="eyebrow">ffsjeffe · instellen</div>
      <h1 className="kop">Even <em>kennismaken</em></h1>
      {melding && <p className="melding fout">{melding}</p>}
      <p className="zacht">Eenmalig per telefoon. Het token blijft alleen op dit toestel.</p>
      <label className="veld">
        Jouw naam
        <input value={naam} onChange={(e) => setNaam(e.target.value)} autoComplete="given-name" />
      </label>
      <label className="veld">
        GitHub-token
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={huidig ? 'laat leeg om te houden' : 'github_pat_…'} autoComplete="off" />
      </label>
      {fout && <p className="melding fout">{fout}</p>}
      <button className="pil" type="submit">Opslaan <span aria-hidden="true">→</span></button>
    </form>
  )
}
