import { MotionGlobalConfig } from 'motion/react'

// jsdom tekent niets: animaties meteen afronden, zodat vensters na sluiten echt verdwijnen
MotionGlobalConfig.skipAnimations = true

// jsdom heeft geen PointerEvent met coördinaten en knop
if (!('PointerEvent' in window)) {
  ;(window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = class extends MouseEvent {} as typeof MouseEvent
}
