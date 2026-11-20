import { parse } from 'yaml'
import { EENHEDEN, parseHoeveelheid } from './eenheden'
import type { Ingredient, Recept, ReceptFout, Verpakkingen } from './types'

export function sleutel(naam: string): string {
  return naam.trim().toLowerCase().replace(/\s+/g, ' ')
}

const VASTE_SYNONIEMEN: Record<string, string> = { teentje: 'teen', snufje: 'snuf' }

/** Eén ingrediëntregel: "<hoeveelheid> <eenheid> <naam>" | "<hoeveelheid> <naam>" | "<naam>". */
export function parseRegel(tekst: string): Ingredient | { fout: string } {
  const delen = tekst.trim().split(/\s+/).filter(Boolean)
  if (delen.length === 0) return { fout: 'lege regel' }
  const h = parseHoeveelheid(delen[0])
  if (h === null) return { naam: delen.join(' '), hoeveelheid: null, eenheid: null }
  const tweede = delen[1]?.toLowerCase()
  const isEenheid = tweede !== undefined && (EENHEDEN as readonly string[]).includes(tweede)
  const naam = delen.slice(isEenheid ? 2 : 1).join(' ')
  if (!naam) return { fout: `"${tekst.trim()}" heeft geen naam` }
  const eenheid = isEenheid ? VASTE_SYNONIEMEN[tweede] ?? tweede : 'stuk'
  return { naam, hoeveelheid: h, eenheid }
}

/** Splitst een notitie in frontmatter (geparsed) en de rest. Gooit bij kapotte YAML. */
function splits(markdown: string): { data: unknown; rest: string } | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown)
  if (!m) return null
  return { data: parse(m[1]), rest: m[2] }
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const isGeheel = (x: unknown, min: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min

/** Tekst onder "## <kop>" tot de volgende "## ". */
function sectie(body: string, kop: string): string {
  const regels = body.split(/\r?\n/)
  const start = regels.findIndex((r) => r.trim().toLowerCase() === `## ${kop}`)
  if (start < 0) return ''
  const rest = regels.slice(start + 1)
  const einde = rest.findIndex((r) => /^##\s/.test(r))
  return (einde < 0 ? rest : rest.slice(0, einde)).join('\n').trim()
}

/** De eerste genummerde lijst in een tekst; vervolgregels horen bij het vorige item. */
function genummerdeLijst(tekst: string): string[] {
  const stappen: string[] = []
  let bezig = false
  for (const regel of tekst.split(/\r?\n/)) {
    const m = /^\s*\d+[.)]\s+(.*)$/.exec(regel)
    if (m) {
      stappen.push(m[1].trim())
      bezig = true
    } else if (bezig && regel.trim() === '') {
      continue
    } else if (bezig && /^\s+\S/.test(regel)) {
      stappen[stappen.length - 1] += ` ${regel.trim()}`
    } else if (bezig) {
      break
    }
  }
  return stappen
}

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
  if (!isGeheel(d.porties, 1)) return fout('porties ontbreekt of is geen geheel getal ≥ 1')
  const avonden = d.avonden ?? 1
  if (!isGeheel(avonden, 1)) return fout('avonden moet een geheel getal ≥ 1 zijn')
  if (!Array.isArray(d.ingredienten)) return fout('ingredienten is geen lijst')

  const ingredienten: Ingredient[] = []
  for (const [i, x] of d.ingredienten.entries()) {
    if (typeof x !== 'string') return fout(`ingrediënt ${i + 1} is geen tekstregel (oud formaat?)`)
    const r = parseRegel(x)
    if ('fout' in r) return fout(`ingrediënt ${i + 1}: ${r.fout}`)
    ingredienten.push(r)
  }

  const titel = pad.split('/').pop()!.replace(/\.md$/, '')
  const bron = typeof d.bron === 'string' && /^https?:\/\//i.test(d.bron.trim()) ? d.bron.trim() : null
  return {
    id: titel,
    titel,
    porties: d.porties,
    tijdMinuten: isGeheel(d.tijd, 0) ? d.tijd : 0,
    avonden,
    bron,
    ingredienten,
    stappen: genummerdeLijst(sectie(delen.rest, 'bereiding')),
    notities: sectie(delen.rest, 'notities'),
  }
}

export function parseVerpakkingen(markdown: string): Verpakkingen {
  let delen
  try {
    delen = splits(markdown)
  } catch {
    return {}
  }
  if (!delen || !isObject(delen.data) || !Array.isArray(delen.data.verpakkingen)) return {}
  const uit: Verpakkingen = {}
  for (const x of delen.data.verpakkingen) {
    if (typeof x !== 'string') continue
    const r = parseRegel(x)
    if ('fout' in r || r.hoeveelheid === null || r.hoeveelheid <= 0) continue
    uit[sleutel(r.naam)] = { hoeveelheid: r.hoeveelheid, eenheid: r.eenheid! }
  }
  return uit
}
