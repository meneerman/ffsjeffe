import { useState } from 'react'

export function Boodschappen({ regels }: { regels: string[] }) {
  const [open, setOpen] = useState(false)
  if (regels.length === 0) return null
  return (
    <section className="boodschappen">
      <button className="uitklap" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>Boodschappen ({regels.length} regels)</span>
        <span aria-hidden="true" className={open ? 'pijl open' : 'pijl'}>›</span>
      </button>
      {open && (
        <ul className="kaart regels">
          {regels.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
    </section>
  )
}
