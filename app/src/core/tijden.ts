export type Tijd = { label: string; seconden: number }

const PER_EENHEID = { uur: 3600, min: 60, sec: 1 } as const
/** langer dan dit zet je geen kooktimer voor (marineren, een nacht rijzen) */
const MAXIMUM = 8 * 3600

const PATROON =
  /(?<![\d,.])(\d+(?:[,.]\d+)?)(?:\s*(?:tot|à|-|–)\s*\d+(?:[,.]\d+)?)?\s*(uurtje|uur|minuutjes|minuutje|minuten|minuut|min|seconden|sec)(?![a-z])|\b(half\s*uur(?:tje)?|halve minuut|kwartier(?:tje)?|een minuutje|een minuut)(?![a-z])/gi

function woord(w: string): Tijd {
  if (w.startsWith('half') && w.includes('uur')) return { label: '30 min', seconden: 1800 }
  if (w.startsWith('halve')) return { label: '30 sec', seconden: 30 }
  if (w.startsWith('kwartier')) return { label: '15 min', seconden: 900 }
  return { label: '1 min', seconden: 60 }
}

/** De kooktijden in een stap; bij "8 tot 10 min" de laagste, zodat je op tijd kunt kijken. */
export function tijden(tekst: string): Tijd[] {
  const gevonden = [...tekst.replace(/\{[^{}]*\}/g, ' ').matchAll(PATROON)].map((m): Tijd => {
    if (m[3]) return woord(m[3].toLowerCase())
    const eenheid = m[2].toLowerCase().startsWith('u') ? 'uur' : m[2].toLowerCase().startsWith('m') ? 'min' : 'sec'
    const getal = m[1].replace('.', ',')
    return { label: `${getal} ${eenheid}`, seconden: Math.round(Number(getal.replace(',', '.')) * PER_EENHEID[eenheid]) }
  })
  return gevonden.filter((t, i) => t.seconden > 0 && t.seconden <= MAXIMUM && gevonden.findIndex((x) => x.seconden === t.seconden) === i)
}
