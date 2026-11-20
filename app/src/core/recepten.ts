import { parse } from 'yaml'
import type { Ingredient, Recept, ReceptFout, Verpakkingen } from './types'

export function sleutel(naam: string): string {
  return naam.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Splitst een notitie in frontmatter (geparsed) en de rest. Gooit bij kapotte YAML. */
function splits(markdown: string): { data: unknown; rest: string } | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown)
  if (!m) return null
  return { data: parse(m[1]), rest: m[2] }
}

const isGetal = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

export function parseRecept(pad: string, markdown: string): Recept | ReceptFout {
  const fout = (f: string): ReceptFout => ({ pad, fout: f })
  let delen
  try {
    delen = splits(markdown)
  } catch (e) {
    return fout(`ongeldige YAML: ${(e as Error).message.split('\n')[0]}`)
  }
  if (!delen) return fout('geen frontmatter')
  const d = delen.data
  if (!isObject(d)) return fout('frontmatter is leeg')
  if (typeof d.titel !== 'string' || !d.titel.trim()) return fout('titel ontbreekt')
  if (!isGetal(d.personen) || d.personen <= 0) return fout('personen ontbreekt of is geen getal > 0')
  const dagen = d.dagen ?? 1
  if (!isGetal(dagen) || !Number.isInteger(dagen) || dagen < 1 || dagen > 5) return fout('dagen moet 1 t/m 5 zijn')
  if (!Array.isArray(d.ingredienten)) return fout('ingredienten is geen lijst')

  const ingredienten: Ingredient[] = []
  for (const [i, x] of d.ingredienten.entries()) {
    if (!isObject(x) || typeof x.naam !== 'string' || !x.naam.trim()) return fout(`ingrediënt ${i + 1} heeft geen naam`)
    const hoeveelheid = isGetal(x.hoeveelheid) ? x.hoeveelheid : null
    const eenheid = typeof x.eenheid === 'string' && x.eenheid.trim() ? x.eenheid.trim() : null
    ingredienten.push({ naam: x.naam.trim(), hoeveelheid, eenheid })
  }

  return {
    id: pad.split('/').pop()!.replace(/\.md$/, ''),
    titel: d.titel.trim(),
    personen: d.personen,
    tijdMinuten: isGetal(d.tijd_minuten) ? d.tijd_minuten : 0,
    dagen,
    bron: typeof d.bron === 'string' && d.bron.trim() ? d.bron.trim() : null,
    ingredienten,
    bereiding: delen.rest,
  }
}

export function parseVerpakkingen(markdown: string): Verpakkingen {
  let delen
  try {
    delen = splits(markdown)
  } catch {
    return {}
  }
  if (!delen || !isObject(delen.data) || !isObject(delen.data.verpakkingen)) return {}
  const uit: Verpakkingen = {}
  for (const [naam, v] of Object.entries(delen.data.verpakkingen)) {
    if (isObject(v) && isGetal(v.hoeveelheid) && v.hoeveelheid > 0 && typeof v.eenheid === 'string') {
      uit[sleutel(naam)] = { hoeveelheid: v.hoeveelheid, eenheid: v.eenheid.trim() }
    }
  }
  return uit
}
