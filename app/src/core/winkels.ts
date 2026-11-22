import { parse } from 'yaml'
import { sleutel } from './recepten'

/** Wat bij de Lidl of de Albert Heijn niet te koop is (sleutel = sleutel(naam)). Bij Lidl te koop betekent ook bij AH te koop. */
export type Winkels = { nietLidl: Set<string>; nietAh: Set<string> }

export const GEEN_WINKELS: Winkels = { nietLidl: new Set(), nietAh: new Set() }

function namen(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((n): n is string => typeof n === 'string' && n.trim() !== '') : []
}

/** Frontmatter met `niet-lidl:` en `niet-ah:`; wat niet klopt is niet te koop-gemarkeerd nergens, dus alles gewoon te koop. */
export function parseWinkels(markdown: string): Winkels {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)
  if (!m) return GEEN_WINKELS
  let data: unknown
  try {
    data = parse(m[1])
  } catch {
    return GEEN_WINKELS
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return GEEN_WINKELS
  const d = data as Record<string, unknown>
  const nietAh = new Set(namen(d['niet-ah']).map(sleutel))
  // niet bij AH is ook niet bij Lidl: bij Lidl te koop betekent bij AH te koop
  const nietLidl = new Set([...namen(d['niet-lidl']).map(sleutel), ...nietAh])
  return { nietLidl, nietAh }
}

export const buitenLidl = (naam: string, w: Winkels) => w.nietLidl.has(sleutel(naam))
export const buitenAh = (naam: string, w: Winkels) => w.nietAh.has(sleutel(naam))
