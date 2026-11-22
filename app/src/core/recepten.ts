import { parse } from 'yaml'
import { EENHEDEN, parseHoeveelheid } from './eenheden'
import { CATEGORIEEN, SOORTEN, type Categorieen, type Ingredient, type Recept, type ReceptFout, type Soort, type Verpakkingen } from './types'

export function sleutel(naam: string): string {
  return naam.trim().toLowerCase().replace(/\s+/g, ' ')
}

export const MAX_VOORAF = 40
const VASTE_SYNONIEMEN: Record<string, string> = { teentje: 'teen', snufje: 'snuf' }

/**
 * Eén ingrediëntregel: "<hoeveelheid> <eenheid> <naam>" | "<hoeveelheid> <naam>" | "<naam>".
 * Ook "400g pasta" (getal direct aan de eenheid) en "2-3 tomaten" (bereik → hoogste getal) worden gelezen.
 * Een regel die met een cijfer begint maar niet te lezen is, geeft een fout: nooit stil zonder hoeveelheid doorgaan.
 */
export function parseRegel(tekst: string): Ingredient | { fout: string } {
  const delen = tekst.trim().split(/\s+/).filter(Boolean)
  if (delen.length === 0) return { fout: 'lege regel' }
  const onleesbaar = { fout: `"${tekst.trim()}" begint met een getal dat niet te lezen is; schrijf "<hoeveelheid> <eenheid> <naam>"` }
  const isEenheidWoord = (w: string | undefined): w is string => w !== undefined && (EENHEDEN as readonly string[]).includes(w.toLowerCase())

  let h = parseHoeveelheid(delen[0])
  let eenheid: string | null = null
  let naamStart = 1
  if (h === null) {
    const aanelkaar = /^(\d+(?:[.,]\d+)?)([a-zA-Z]+)$/.exec(delen[0])
    const bereik = /^(\d+)[-–](\d+)$/.exec(delen[0])
    if (aanelkaar && isEenheidWoord(aanelkaar[2])) {
      h = parseHoeveelheid(aanelkaar[1])
      eenheid = aanelkaar[2].toLowerCase()
    } else if (bereik) {
      h = Math.max(Number(bereik[1]), Number(bereik[2]))
    } else if (/^\d/.test(delen[0])) {
      return onleesbaar
    } else {
      return { naam: delen.join(' '), hoeveelheid: null, eenheid: null }
    }
  }
  if (eenheid === null) {
    if (isEenheidWoord(delen[1])) {
      eenheid = delen[1].toLowerCase()
      naamStart = 2
    } else if (delen[1] !== undefined && /^\d/.test(delen[1])) {
      return onleesbaar
    }
  }
  const naam = delen.slice(naamStart).join(' ')
  if (!naam) return { fout: `"${tekst.trim()}" heeft geen naam` }
  return { naam, hoeveelheid: h, eenheid: eenheid ? VASTE_SYNONIEMEN[eenheid] ?? eenheid : 'stuk' }
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

/** De eerste lijst (genummerd of met - / *) in een tekst; ingesprongen vervolgregels horen bij het vorige item. */
function lijst(tekst: string): string[] {
  const items: string[] = []
  let bezig = false
  for (const regel of tekst.split(/\r?\n/)) {
    const m = /^\s*(?:\d+[.)]|[-*])\s+(.*)$/.exec(regel)
    if (m) {
      items.push(m[1].trim())
      bezig = true
    } else if (bezig && regel.trim() === '') {
      continue
    } else if (bezig && /^\s+\S/.test(regel)) {
      items[items.length - 1] += ` ${regel.trim()}`
    } else if (bezig) {
      break
    }
  }
  return items
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
  const soort = typeof d.soort === 'string' ? d.soort.trim().toLowerCase() : d.soort === undefined || d.soort === null ? 'avondeten' : ''
  if (!(SOORTEN as readonly string[]).includes(soort)) return fout(`soort moet een van ${SOORTEN.join(', ')} zijn`)
  const vries = d.invriezen
  const invriezen = vries === undefined || vries === null ? false : vries === true || vries === 'ja' ? true : vries === false || vries === 'nee' ? null : undefined
  if (invriezen === undefined) return fout('invriezen moet ja of nee zijn')
  if (!Array.isArray(d.ingredienten)) return fout('ingredienten is geen lijst')

  const ingredienten: Ingredient[] = []
  for (const [i, x] of d.ingredienten.entries()) {
    if (typeof x !== 'string') return fout(`ingrediënt ${i + 1} is geen tekstregel (oud formaat?)`)
    const r = parseRegel(x)
    if ('fout' in r) return fout(`ingrediënt ${i + 1}: ${r.fout}`)
    ingredienten.push(r)
  }

  const titel = pad.split('/').pop()!.replace(/\.md$/, '')
  if (d.vooraf !== undefined && d.vooraf !== null && typeof d.vooraf !== 'string') return fout('vooraf moet een korte tekst zijn, bijv. "24 uur marineren"')
  const vooraf = typeof d.vooraf === 'string' && d.vooraf.trim() ? d.vooraf.trim() : null
  if (vooraf && vooraf.length > MAX_VOORAF) return fout(`vooraf is te lang (max ${MAX_VOORAF} tekens): houd het kort, bijv. "24 uur marineren"`)
  const bron = typeof d.bron === 'string' && /^https?:\/\//i.test(d.bron.trim()) ? d.bron.trim() : null
  return {
    id: titel,
    titel,
    soort: soort as Soort,
    invriezen: invriezen === true,
    porties: d.porties,
    tijdMinuten: isGeheel(d.tijd, 0) ? d.tijd : 0,
    vooraf,
    avonden,
    bron,
    ingredienten,
    benodigdheden: lijst(sectie(delen.rest, 'benodigdheden')),
    voorbereiding: lijst(sectie(delen.rest, 'voorbereiding')),
    stappen: lijst(sectie(delen.rest, 'bereiding')),
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

/** Frontmatter is een map van categorie naar een lijst ingrediëntnamen; wat niet klopt wordt overgeslagen. */
export function parseCategorieen(markdown: string): Categorieen {
  let delen
  try {
    delen = splits(markdown)
  } catch {
    return {}
  }
  if (!delen || !isObject(delen.data)) return {}
  const uit: Categorieen = {}
  for (const categorie of CATEGORIEEN) {
    const namen = delen.data[categorie]
    if (!Array.isArray(namen)) continue
    for (const naam of namen) if (typeof naam === 'string' && naam.trim()) uit[sleutel(naam)] = categorie
  }
  return uit
}
