import { tijden } from '../core/tijden'
import { ontgrendel } from './alarm'
import { klok, plusMinuut, startTimer, stopTimer, useTimers } from './timers'

type Plek = { plek: string; receptId: string; naam: string }

/**
 * Timers van een stap- of voorbereidingskaart. Naast de tekst staat per tijd één knop (starten, en op dezelfde
 * plek stoppen, zodat de tekst niet verspringt); een lopende timer krijgt eronder een regel met de resttijd.
 */
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
  // alleen bij meer tijden in één kaart is een bijschrift nodig om ze te onderscheiden
  const meer = rijen.length > 1
  return (
    <>
      <div className="timer-knoppen">
        {rijen.map(({ tijd, id, timer }) => {
          // afgelopen: de grote knop "Zet uit" onder de tekst neemt het over
          if (timer && timer.eind <= nu) return null
          return (
            <button key={id} className="timer-start" onClick={() => (timer ? stopTimer(id) : start(id, tijd.seconden))}
              aria-label={timer ? 'Stop' : `Start timer ${tijd.label} bij ${naam.toLowerCase()}`} title={timer ? 'Stop' : `Timer ${tijd.label}`}>
              {timer ? <Kruisje /> : <Klokje />}
              {meer && <span aria-hidden="true">{tijd.label}</span>}
            </button>
          )
        })}
      </div>
      {rijen.some((r) => r.timer) && (
        <div className="timers">
          {rijen.map(({ tijd, id, timer }) => {
            if (!timer) return null
            const rest = timer.eind - nu
            const af = rest <= 0
            return (
              <div key={id} className={`timer${af ? ' af' : ''}`} role="group" aria-label={`Timer ${tijd.label}`}>
                <span className="timer-klok" role={af ? 'alert' : 'timer'}>{af ? 'Tijd is om!' : klok(rest)}</span>
                <button className="timer-knop" aria-label="+1 min" onClick={() => { ontgrendel(); plusMinuut(id) }}>+1</button>
                {af && <button className="knop primair timer-uit" onClick={() => stopTimer(id)}>Zet uit</button>}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function Kruisje() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  )
}

function Klokje() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5V9.5M10 2.5h4M12 2.5V6M18.5 6.5l1.5-1.5" />
    </svg>
  )
}
