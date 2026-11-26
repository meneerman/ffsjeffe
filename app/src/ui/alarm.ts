// Geluid via Web Audio. Telefoons laten dat pas toe na een tik: `ontgrendel` hoort in een klik.
type Venster = Window & { webkitAudioContext?: typeof AudioContext }
type MetSessie = Navigator & { audioSession?: { type: string } }

let context: AudioContext | null = null

export function ontgrendel() {
  try {
    const Klasse = window.AudioContext ?? (window as Venster).webkitAudioContext
    if (!Klasse) return
    context ??= new Klasse()
    if (context.state !== 'running') void context.resume().catch(() => {})
  } catch {
    /* geen geluid mogelijk: de kaart schudt nog steeds */
  }
}

/** iPhone: met 'playback' klinkt het alarm ook met de stilschakelaar aan. */
function sessie(type: 'playback' | 'auto') {
  try {
    const s = (navigator as MetSessie).audioSession
    if (s) s.type = type
  } catch {
    /* niet ondersteund */
  }
}

/** Drie korte hoge piepjes. */
export function piep() {
  sessie('playback')
  // trillen (Android) mag pas na een tik; eerder geeft de browser alleen een foutmelding
  if ((navigator as { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive !== false) navigator.vibrate?.([300, 150, 300])
  ontgrendel()
  if (!context) return
  for (const n of [0, 1, 2]) {
    const toon = context.createOscillator()
    const volume = context.createGain()
    const start = context.currentTime + n * 0.25
    toon.type = 'square'
    toon.frequency.value = 880
    volume.gain.setValueAtTime(0.0001, start)
    volume.gain.exponentialRampToValueAtTime(0.5, start + 0.02)
    volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
    toon.connect(volume).connect(context.destination)
    toon.start(start)
    toon.stop(start + 0.2)
  }
}

export function stil() {
  sessie('auto')
  if ((navigator as { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive !== false) navigator.vibrate?.(0)
}
