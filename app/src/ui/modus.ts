export type Modus = 'bereiden' | 'plannen'
const SLEUTEL = 'ffsjeffe.modus'

/**
 * Welke kant van het menu je laatst gebruikte. Zo kom je na Alle recepten, een kookpagina of "terug" weer op
 * dezelfde kant uit, in plaats van dat het scherm zelf opnieuw kiest. Alleen voor deze sessie van de app.
 */
export function leesModus(): Modus | null {
  try {
    const v = sessionStorage.getItem(SLEUTEL)
    return v === 'bereiden' || v === 'plannen' ? v : null
  } catch {
    return null
  }
}

export function schrijfModus(m: Modus): void {
  try {
    sessionStorage.setItem(SLEUTEL, m)
  } catch {
    /* zonder opslag kiest het scherm gewoon zelf */
  }
}
