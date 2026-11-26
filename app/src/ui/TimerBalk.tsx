import { useEffect } from 'react'
import { ontgrendel, piep, stil } from './alarm'
import { klok, stopTimer, useTimers } from './timers'
import { useSchermAan } from './useSchermAan'

/**
 * Hoort één keer in de app: laat afgelopen timers klinken, houdt het scherm aan en toont onderin
 * de timers die je op deze pagina niet ziet, plus alle afgelopen timers.
 */
export function TimerBalk({ hash }: { hash: string }) {
  const { timers, nu } = useTimers()
  const loopt = timers.length > 0
  const alarm = timers.some((t) => t.eind <= nu)
  useSchermAan(loopt)

  // na herladen of terugkomen mag er pas weer geluid na een tik
  useEffect(() => {
    if (!loopt) return
    document.addEventListener('pointerdown', ontgrendel)
    return () => document.removeEventListener('pointerdown', ontgrendel)
  }, [loopt])

  useEffect(() => {
    if (!alarm) return
    piep()
    const t = setInterval(piep, 1500)
    return () => { clearInterval(t); stil() }
  }, [alarm])

  const open = hash.startsWith('#/recept/') ? decodeURIComponent(hash.slice('#/recept/'.length)) : null
  const getoond = timers.filter((t) => t.eind <= nu || t.receptId !== open).sort((a, b) => a.eind - b.eind)
  if (getoond.length === 0) return null
  return (
    <ul className="timerbalk" aria-label="Timers">
      {getoond.map((t) => {
        const af = t.eind <= nu
        return (
          <li key={t.id} className={af ? 'af' : ''}>
            <a href={`#/recept/${encodeURIComponent(t.receptId)}`}>
              <span className="timerbalk-klok">{af ? 'Klaar!' : klok(t.eind - nu)}</span>
              <span className="timerbalk-naam">{t.naam} · {t.receptId}</span>
            </a>
            {af && <button className="knop primair" onClick={() => stopTimer(t.id)} aria-label={`Zet timer uit: ${t.naam} ${t.receptId}`}>Zet uit</button>}
          </li>
        )
      })}
    </ul>
  )
}
