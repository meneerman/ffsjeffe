import { useEffect, useState } from 'react'
import type { KeepStatus } from '../data/github'
import type { Repo } from './useData'

const nieuwer = (s: KeepStatus | null, sinds: string) => s !== null && Date.parse(s.tijd) >= Date.parse(sinds)

export function KeepStatusMelding({ repo, vastgezetOp, begin, verberg = false, interval = 10_000, max = 180_000 }: {
  repo: Pick<Repo, 'keepStatus'>
  vastgezetOp: string | null
  begin: KeepStatus | null
  /** bijv. zolang er een concept is: de melding gaat over het vastgezette menu, niet over het concept */
  verberg?: boolean
  interval?: number
  max?: number
}) {
  const [status, setStatus] = useState<KeepStatus | null>(begin)
  const [opgegeven, setOpgegeven] = useState(false)
  const wachten = vastgezetOp !== null && !nieuwer(status, vastgezetOp)

  useEffect(() => {
    if (!wachten || opgegeven) return
    let verstreken = 0
    const id = setInterval(async () => {
      verstreken += interval
      try {
        const s = await repo.keepStatus()
        if (s) setStatus(s)
      } catch {
        /* volgende ronde opnieuw */
      }
      if (verstreken >= max) setOpgegeven(true)
    }, interval)
    return () => clearInterval(id)
  }, [wachten, opgegeven, repo, interval, max])

  if (verberg) return null
  if (wachten) return <p className="melding zacht">{opgegeven ? 'Keep reageert nog niet. Kijk straks nog eens.' : 'Keep bijwerken…'}</p>
  if (status && !status.ok) return <p className="melding fout">Keep bijwerken mislukt: {status.melding}</p>
  if (vastgezetOp && status?.ok) return <p className="melding goed">Staat in Keep ✓</p>
  return null
}
