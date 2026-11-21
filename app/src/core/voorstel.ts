import { aantalVerpakkingen, behoeften, schaalfactor } from './boodschappen'
import { normaliseer } from './eenheden'
import { datumNL } from './menu'
import { sleutel } from './recepten'
import type { Gerecht, Recept, Verpakkingen } from './types'

const NOOIT = 84 // dagen
const GEWICHT_WILLEKEUR = 2
const GEWICHT_RESTJES = 6
const DAG_MS = 86_400_000

/** Kalenderdagen tussen een datum (YYYY-MM-DD) en vandaag in Amsterdam. */
export function dagenGeleden(datum: string, vandaag: Date): number {
  return Math.round((Date.parse(datumNL(vandaag)) - Date.parse(datum)) / DAG_MS)
}

/** Per verpakt ingrediënt wat er na afronden op hele verpakkingen overblijft (basiseenheid). */
export function restjes(gerechten: Gerecht[], recepten: Record<string, Recept>, verpakkingen: Verpakkingen): Record<string, number> {
  const uit: Record<string, number> = {}
  for (const b of behoeften(gerechten, recepten)) {
    const n = aantalVerpakkingen(b, verpakkingen)
    if (n === null) continue
    const v = verpakkingen[sleutel(b.naam)]
    const rest = n * normaliseer(v.hoeveelheid, v.eenheid).hoeveelheid - b.hoeveelheid!
    if (rest > 0) uit[sleutel(b.naam)] = rest
  }
  return uit
}

function restdekking(r: Recept, rest: Record<string, number>, verpakkingen: Verpakkingen, eters: number): number {
  const factor = schaalfactor(r, eters, r.avonden)
  let dekking = 0
  for (const i of r.ingredienten) {
    const k = sleutel(i.naam)
    if (i.hoeveelheid === null || !rest[k] || !verpakkingen[k]) continue
    const nodig = normaliseer(i.hoeveelheid * factor, i.eenheid)
    const maat = normaliseer(verpakkingen[k].hoeveelheid, verpakkingen[k].eenheid)
    if (nodig.eenheid !== maat.eenheid) continue
    dekking += Math.min(nodig.hoeveelheid, rest[k]) / maat.hoeveelheid
  }
  return dekking
}

export function score(
  r: Recept, laatstGegeten: Record<string, string>, vandaag: Date, rest: Record<string, number>,
  verpakkingen: Verpakkingen, eters: number, rnd: number,
): number {
  const dagen = laatstGegeten[r.id] ? Math.min(Math.max(dagenGeleden(laatstGegeten[r.id], vandaag), 0), NOOIT) : NOOIT
  return dagen / 7 + GEWICHT_WILLEKEUR * rnd + GEWICHT_RESTJES * restdekking(r, rest, verpakkingen, eters)
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(s: string): number {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

function willekeur(recepten: Recept[], seed: string): Record<string, number> {
  const rnd = mulberry32(hash(seed))
  const uit: Record<string, number> = {}
  for (const r of [...recepten].sort((a, b) => a.id.localeCompare(b.id))) uit[r.id] = rnd()
  return uit
}

export function kandidaten(
  gerechten: Gerecht[], recepten: Recept[], laatstGegeten: Record<string, string>,
  verpakkingen: Verpakkingen, eters: number, seed: string, vandaag: Date,
): Recept[] {
  const perId = Object.fromEntries(recepten.map((r) => [r.id, r]))
  const rest = restjes(gerechten, perId, verpakkingen)
  const rnd = willekeur(recepten, seed)
  const op = new Set(gerechten.map((g) => g.receptId))
  const s = new Map(recepten.filter((r) => r.soort === 'avondeten' && !op.has(r.id)).map((r) => [r.id, score(r, laatstGegeten, vandaag, rest, verpakkingen, eters, rnd[r.id])]))
  return recepten.filter((r) => s.has(r.id)).sort((a, b) => s.get(b.id)! - s.get(a.id)! || a.id.localeCompare(b.id))
}

export function stelVoor(
  recepten: Recept[], laatstGegeten: Record<string, string>, verpakkingen: Verpakkingen,
  eters: number, seed: string, vandaag: Date, aantal = 3,
): Gerecht[] {
  const gerechten: Gerecht[] = []
  while (gerechten.length < aantal) {
    const beste = kandidaten(gerechten, recepten, laatstGegeten, verpakkingen, eters, seed, vandaag)[0]
    if (!beste) break
    gerechten.push({ receptId: beste.id, eters, avonden: beste.avonden, gegetenOp: null, vorigeKeer: null })
  }
  return gerechten
}

/**
 * Het gerecht `receptId` vervangen door het volgende beste alternatief, op dezelfde plek en met
 * dezelfde eters en avonden. `overslaan` zijn recepten die al eens zijn weggeveegd (niet terug laten komen).
 * null als er geen alternatief is.
 */
export function vervang(
  gerechten: Gerecht[], receptId: string, recepten: Recept[], laatstGegeten: Record<string, string>,
  verpakkingen: Verpakkingen, eters: number, seed: string, vandaag: Date, overslaan: Set<string>,
): Gerecht[] | null {
  const oud = gerechten.find((g) => g.receptId === receptId)
  if (!oud) return null
  const rest = gerechten.filter((g) => g !== oud)
  const nieuw = kandidaten(rest, recepten, laatstGegeten, verpakkingen, eters, seed, vandaag)
    .find((r) => r.id !== receptId && !overslaan.has(r.id))
  if (!nieuw) return null
  return gerechten.map((g) => (g === oud ? { receptId: nieuw.id, eters: oud.eters, avonden: oud.avonden, gegetenOp: null, vorigeKeer: null } : g))
}
