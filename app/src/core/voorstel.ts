import { aantalVerpakkingen, behoeften, schaalfactor } from './boodschappen'
import { normaliseer } from './eenheden'
import { sleutel } from './recepten'
import type { Recept, Slot, Verpakkingen, WeekPlan } from './types'
import { weekVerschil } from './week'

export const MAX_DAGEN = 5
const NOOIT_GEGETEN = 12
const GEWICHT_WILLEKEUR = 2
const GEWICHT_RESTJES = 6

const som = (slots: Slot[]) => slots.reduce((n, s) => n + s.dagen, 0)

/** receptId -> laatste week waarin het in een vastgezet plan stond. */
export function geschiedenis(plannen: WeekPlan[]): Record<string, string> {
  const uit: Record<string, string> = {}
  for (const p of plannen) for (const s of p.slots) if (!uit[s.receptId] || p.week > uit[s.receptId]) uit[s.receptId] = p.week
  return uit
}

/** Per verpakt ingrediënt wat er na afronden op hele verpakkingen overblijft (basiseenheid). */
export function restjes(slots: Slot[], recepten: Record<string, Recept>, verpakkingen: Verpakkingen, huishouden: number): Record<string, number> {
  const uit: Record<string, number> = {}
  for (const b of behoeften(slots, recepten, huishouden)) {
    const n = aantalVerpakkingen(b, verpakkingen)
    if (n === null) continue
    const v = verpakkingen[sleutel(b.naam)]
    const rest = n * normaliseer(v.hoeveelheid, v.eenheid).hoeveelheid - b.hoeveelheid!
    if (rest > 0) uit[sleutel(b.naam)] = rest
  }
  return uit
}

/** Hoeveel verpakkingen-aan-restjes dit recept opmaakt. */
function restdekking(r: Recept, rest: Record<string, number>, verpakkingen: Verpakkingen, huishouden: number): number {
  const factor = schaalfactor(r, r.dagen, huishouden)
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
  r: Recept, week: string, gesch: Record<string, string>, rest: Record<string, number>,
  verpakkingen: Verpakkingen, huishouden: number, rnd: number,
): number {
  const weken = gesch[r.id] ? Math.min(weekVerschil(gesch[r.id], week), NOOIT_GEGETEN) : NOOIT_GEGETEN
  return weken + GEWICHT_WILLEKEUR * rnd + GEWICHT_RESTJES * restdekking(r, rest, verpakkingen, huishouden)
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

/** Vaste willekeur per (week, recept): zelfde week = zelfde voorstel. */
function willekeur(recepten: Recept[], week: string): Record<string, number> {
  const rnd = mulberry32(hash(week))
  const uit: Record<string, number> = {}
  for (const r of [...recepten].sort((a, b) => a.id.localeCompare(b.id))) uit[r.id] = rnd()
  return uit
}

type Context = { week: string; gesch: Record<string, string>; rnd: Record<string, number>; perId: Record<string, Recept>; verpakkingen: Verpakkingen; huishouden: number }

function context(recepten: Recept[], week: string, plannen: WeekPlan[], verpakkingen: Verpakkingen, huishouden: number): Context {
  return {
    week,
    gesch: geschiedenis(plannen.filter((p) => p.week < week)),
    rnd: willekeur(recepten, week),
    perId: Object.fromEntries(recepten.map((r) => [r.id, r])),
    verpakkingen,
    huishouden,
  }
}

function gescoord(kandidaten: Recept[], slots: Slot[], c: Context): Recept[] {
  const rest = restjes(slots, c.perId, c.verpakkingen, c.huishouden)
  const s = new Map(kandidaten.map((r) => [r.id, score(r, c.week, c.gesch, rest, c.verpakkingen, c.huishouden, c.rnd[r.id])]))
  return [...kandidaten].sort((a, b) => s.get(b.id)! - s.get(a.id)! || a.id.localeCompare(b.id))
}

export function stelVoor(recepten: Recept[], week: string, plannen: WeekPlan[], verpakkingen: Verpakkingen, huishouden: number): Slot[] {
  const c = context(recepten, week, plannen, verpakkingen, huishouden)
  const slots: Slot[] = []
  for (;;) {
    const ruimte = MAX_DAGEN - som(slots)
    const kandidaten = recepten.filter((r) => r.dagen <= ruimte && !slots.some((s) => s.receptId === r.id))
    if (kandidaten.length === 0) return slots
    const beste = gescoord(kandidaten, slots, c)[0]
    slots.push({ receptId: beste.id, dagen: beste.dagen })
  }
}

export function alternatieven(
  slotIndex: number, slots: Slot[], recepten: Recept[], week: string,
  plannen: WeekPlan[], verpakkingen: Verpakkingen, huishouden: number,
): Recept[] {
  const zonder = slots.filter((_, i) => i !== slotIndex)
  const ruimte = MAX_DAGEN - som(zonder)
  const kandidaten = recepten.filter((r) => r.dagen <= ruimte && !slots.some((s) => s.receptId === r.id))
  return gescoord(kandidaten, zonder, context(recepten, week, plannen, verpakkingen, huishouden))
}

export function vervang(slots: Slot[], index: number, r: Recept): Slot[] {
  const nieuw = slots.map((s, i) => (i === index ? { receptId: r.id, dagen: r.dagen } : s))
  if (som(nieuw) > MAX_DAGEN) throw new Error('past niet')
  return nieuw
}
