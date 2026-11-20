import type { Slot } from './types'

export const DAGEN = ['ma', 'di', 'wo', 'do', 'vr'] as const
export type Dag = (typeof DAGEN)[number]

const DAG_MS = 86_400_000

/** ISO-week van de lokale kalenderdatum, als "YYYY-Www". */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dag = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dag) // donderdag van deze week bepaalt het jaar
  const jaar = t.getUTCFullYear()
  const week = Math.ceil(((t.getTime() - Date.UTC(jaar, 0, 1)) / DAG_MS + 1) / 7)
  return `${jaar}-W${String(week).padStart(2, '0')}`
}

/** Maandag (lokale datum, 00:00) van een ISO-week. */
export function maandagVan(week: string): Date {
  const [jaar, w] = week.split('-W').map(Number)
  const jan4 = new Date(Date.UTC(jaar, 0, 4))
  const maandagWeek1 = jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * DAG_MS
  const m = new Date(maandagWeek1 + (w - 1) * 7 * DAG_MS)
  return new Date(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate())
}

export function weekVerschil(a: string, b: string): number {
  const ua = maandagVan(a), ub = maandagVan(b)
  return Math.round((Date.UTC(ub.getFullYear(), ub.getMonth(), ub.getDate()) - Date.UTC(ua.getFullYear(), ua.getMonth(), ua.getDate())) / (7 * DAG_MS))
}

export function volgendeWeek(week: string): string {
  const m = maandagVan(week)
  return isoWeek(new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7))
}

/** Zaterdag en zondag plannen de volgende week, maandag t/m vrijdag de huidige. */
export function teplannenWeek(vandaag: Date): string {
  const dag = vandaag.getDay()
  return dag === 0 || dag === 6 ? volgendeWeek(isoWeek(vandaag)) : isoWeek(vandaag)
}

export function indeling(slots: Slot[]): { dag: Dag; receptId: string; vervolg: boolean }[] {
  const uit: { dag: Dag; receptId: string; vervolg: boolean }[] = []
  for (const s of slots) {
    for (let i = 0; i < s.dagen && uit.length < DAGEN.length; i++) {
      uit.push({ dag: DAGEN[uit.length], receptId: s.receptId, vervolg: i > 0 })
    }
  }
  return uit
}
