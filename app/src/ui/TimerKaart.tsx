import { tijden } from '../core/tijden'
import { ontgrendel } from './alarm'
import { klok, plusMinuut, startTimer, stopTimer, useTimers } from './timers'

type Plek = { plek: string; receptId: string; naam: string }

/** Onderin een stap- of voorbereidingskaart: startknop per tijd in de tekst, of de lopende timer. */
export function TimerKaart({ tekst, plek, receptId, naam, startbaar }: Plek & { tekst: string; startbaar: boolean }) {
  const { timers, nu } = useTimers()
  const rijen = tijden(tekst)
    .map((tijd) => ({ tijd, id: `${plek}|${tijd.seconden}`, timer: timers.find((t) => t.id === `${plek}|${tijd.seconden}`) }))
    .filter((r) => r.timer || startbaar)
  if (rijen.length === 0) return null
  const start = (id: string, duur: number) => {
    ontgrendel()
    startTimer({ id, plek, receptId, naam, duur })
  }
  return (
    <div className="timers">
      {rijen.map(({ tijd, id, timer }) => {
        if (!timer) {
          return (
            <button key={id} className="timer-start" onClick={() => start(id, tijd.seconden)} aria-label={`Start timer ${tijd.label} bij ${naam.toLowerCase()}`}>
              <span aria-hidden="true">⏱</span> Start {tijd.label}
            </button>
          )
        }
        const rest = timer.eind - nu
        const af = rest <= 0
        return (
          <div key={id} className={`timer${af ? ' af' : ''}`} role="group" aria-label={`Timer ${tijd.label}`}>
            <div className="timer-balk" aria-hidden="true"><span style={{ transform: `scaleX(${Math.max(0, Math.min(1, rest / (timer.duur * 1000)))})` }} /></div>
            <div className="timer-rij">
              <span className="timer-klok" role={af ? 'alert' : 'timer'}>{af ? 'Tijd is om!' : klok(rest)}</span>
              <button className="knop" onClick={() => { ontgrendel(); plusMinuut(id) }}>+1 min</button>
              <button className={`knop${af ? ' primair timer-uit' : ''}`} onClick={() => stopTimer(id)}>{af ? 'Zet uit' : 'Stop'}</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
