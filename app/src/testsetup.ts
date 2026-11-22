import { MotionGlobalConfig } from 'motion/react'

// jsdom tekent niets: animaties meteen afronden, zodat vensters na sluiten echt verdwijnen
MotionGlobalConfig.skipAnimations = true
