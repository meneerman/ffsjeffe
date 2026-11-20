import { registerSW } from 'virtual:pwa-register'

/**
 * Zorgt dat een geïnstalleerde app (vooral op iPhone, waar hij vaak ingevroren op de achtergrond
 * staat) de nieuwste versie oppakt: controleren bij terugkomen en elk uur, en herladen zodra er
 * een nieuwe versie klaarstaat.
 */
export function startUpdates(): void {
  if (!('serviceWorker' in navigator)) return
  const had = !!navigator.serviceWorker.controller
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registratie) {
      if (!registratie) return
      const controleer = () => { registratie.update().catch(() => {}) }
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') controleer() })
      setInterval(controleer, 60 * 60 * 1000)
    },
  })
  // een nieuwe versie heeft het roer overgenomen: herladen (niet bij de allereerste installatie)
  let herlaadt = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had || herlaadt) return
    herlaadt = true
    location.reload()
  })
}
