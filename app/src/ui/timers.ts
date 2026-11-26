import { useEffect, useState, useSyncExternalStore } from 'react'
import { lees, schrijf } from './opslag'

/** `eind` in ms sinds 1970; de resttijd volgt dus uit de klok en klopt ook na herladen of slapen. `plek` = de kaart. */
export type Timer = { id: string; plek: string; receptId: string; naam: string; duur: number; eind: number }

const SLEUTEL = 'ffsjeffe.timers'
/** langer geleden afgelopen: niet meer alsnog laten afgaan */
const VERGETEN_NA = 2 * 3600 * 1000

let lijst: Timer[] | null = null
const luisteraars = new Set<() => void>()

export function leesTimers(): Timer[] {
  lijst ??= (lees<Timer[]>(SLEUTEL) ?? []).filter((t) => Date.now() - t.eind < VERGETEN_NA)
  return lijst
}
function zet(nieuw: Timer[]) {
  lijst = nieuw
  schrijf(SLEUTEL, nieuw.length ? nieuw : null)
  luisteraars.forEach((f) => f())
}
const abonneer = (f: () => void) => {
  luisteraars.add(f)
  return () => { luisteraars.delete(f) }
}

export function startTimer(t: Omit<Timer, 'eind'>) {
  zet([...leesTimers().filter((x) => x.id !== t.id), { ...t, eind: Date.now() + t.duur * 1000 }])
}
export const stopTimer = (id: string) => zet(leesTimers().filter((t) => t.id !== id))
/** Een lopende timer krijgt er een minuut bij; een afgelopen timer begint opnieuw met een minuut. */
export function plusMinuut(id: string) {
  const nu = Date.now()
  zet(leesTimers().map((t) => (t.id !== id ? t : t.eind <= nu ? { ...t, duur: 60, eind: nu + 60_000 } : { ...t, duur: t.duur + 60, eind: t.eind + 60_000 })))
}
/** Alleen voor tests: opnieuw uit de opslag lezen. */
export function vergeetTimers() { lijst = null }

/** De timers plus de huidige tijd, vier keer per seconde ververst zolang er iets loopt. */
export function useTimers(): { timers: Timer[]; nu: number } {
  const timers = useSyncExternalStore(abonneer, leesTimers)
  const [, tik] = useState(0)
  const loopt = timers.length > 0
  useEffect(() => {
    if (!loopt) return
    const t = setInterval(() => tik((n) => n + 1), 250)
    return () => clearInterval(t)
  }, [loopt])
  return { timers, nu: Date.now() }
}

/** "4:32" of "1:05:00", naar boven afgerond zodat 0:00 pas bij afgelopen verschijnt. */
export function klok(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const [u, m, rest] = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
  const twee = (n: number) => String(n).padStart(2, '0')
  return u > 0 ? `${u}:${twee(m)}:${twee(rest)}` : `${m}:${twee(rest)}`
}

/** Wat de timers van één kaart met die kaart doen. */
export function kaartStand(timers: Timer[], nu: number, plek: string): '' | 'loopt' | 'af' {
  const hier = timers.filter((t) => t.plek === plek)
  return hier.some((t) => t.eind <= nu) ? 'af' : hier.length ? 'loopt' : ''
}
