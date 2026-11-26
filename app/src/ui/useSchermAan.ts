import { useEffect, useState } from 'react'

type Lock = { release: () => Promise<void>; released?: boolean; addEventListener?: (t: 'release', f: () => void) => void }
type WakeLockApi = { request: (t: 'screen') => Promise<Lock> }

/**
 * Houdt het scherm aan zolang `aan` waar is. Telefoons laten de vergrendeling los zodra je
 * de app even verlaat; bij terugkomen wordt hij opnieuw aangevraagd. Geeft terug of hij actief is.
 */
export function useSchermAan(aan = true): boolean {
  const [actief, setActief] = useState(false)
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock
    if (!wl || !aan) return
    let lock: Lock | null = null
    let weg = false
    const vraag = () => {
      if (weg || (lock && !lock.released)) return
      wl.request('screen').then((l) => {
        if (weg) return void l.release().catch(() => {})
        lock = l
        setActief(true)
        l.addEventListener?.('release', () => { lock = null; setActief(false) })
      }).catch(() => setActief(false))
    }
    const zichtbaar = () => { if (document.visibilityState === 'visible') { lock = lock?.released ? null : lock; vraag() } }
    vraag()
    document.addEventListener('visibilitychange', zichtbaar)
    return () => {
      weg = true
      document.removeEventListener('visibilitychange', zichtbaar)
      lock?.release().catch(() => {})
      setActief(false)
    }
  }, [aan])
  return actief
}
