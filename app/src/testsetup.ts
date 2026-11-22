import { MotionGlobalConfig } from 'motion/react'
import { beforeEach } from 'vitest'

// jsdom tekent niets: animaties meteen afronden, zodat vensters na sluiten echt verdwijnen
MotionGlobalConfig.skipAnimations = true

// jsdom heeft geen PointerEvent met coördinaten en knop
if (!('PointerEvent' in window)) {
  ;(window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = class extends MouseEvent {} as typeof MouseEvent
}

// de onthouden keuze Plannen/Bereiden mag niet van de ene test in de andere lekken
beforeEach(() => { try { sessionStorage.clear() } catch { /* geen opslag */ } })
