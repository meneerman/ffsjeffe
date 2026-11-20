import { expect, test } from 'vitest'
import { alternatieven, geschiedenis, restjes, score, stelVoor, vervang } from './voorstel'
import { ing, recept } from './testdata'
import type { Recept, Slot, WeekPlan } from './types'

const W = '2026-W48'
const gegeten = (week: string, ...ids: string[]): WeekPlan => ({
  week, status: 'vastgezet', slots: ids.map((receptId) => ({ receptId, dagen: 1 })), boodschappen: [], vastgezetOp: '', door: '',
})
const som = (s: Slot[]) => s.reduce((n, x) => n + x.dagen, 0)
const reeks = (n: number) => Array.from({ length: n }, (_, i) => recept(`r${i}`, [ing('ui', 1, 'stuk')]))
const VP = { 'crème fraîche': { hoeveelheid: 200, eenheid: 'ml' } }

test('nooit meer dan 5 dagen', () => {
  const rs = [...reeks(8), recept('twee', [], { dagen: 2 }), recept('drie', [], { dagen: 3 })]
  const s = stelVoor(rs, W, [], {}, 2)
  expect(som(s)).toBeLessThanOrEqual(5)
  expect(s.length).toBeGreaterThan(0)
})

test('meerdaags gerecht dat niet meer past wordt overgeslagen, niet afgekapt', () => {
  const rs = [...reeks(4), recept('twee', [], { dagen: 2 })]
  const s = stelVoor(rs, W, [gegeten('2026-W47', 'twee')], {}, 2)
  expect(s.map((x) => x.receptId).sort()).toEqual(['r0', 'r1', 'r2', 'r3'])
  expect(som(s)).toBe(4)
})

test('slots nemen de dagen van het recept over', () => {
  const s = stelVoor([recept('twee', [], { dagen: 2 })], W, [], {}, 2)
  expect(s).toEqual([{ receptId: 'twee', dagen: 2 }])
})

test('te weinig recepten geeft een korter voorstel', () => expect(stelVoor(reeks(2), W, [], {}, 2)).toHaveLength(2))

test('geen recepten geeft een leeg voorstel', () => expect(stelVoor([], W, [], {}, 2)).toEqual([]))

test('lang niet gegeten gaat voor', () => {
  const s = stelVoor([recept('A', []), recept('B', [])], W, [gegeten('2026-W47', 'A'), gegeten('2026-W38', 'B')], {}, 2)
  expect(s[0].receptId).toBe('B')
})

test('geschiedenis: laatste week per recept', () =>
  expect(geschiedenis([gegeten('2026-W40', 'A', 'B'), gegeten('2026-W45', 'A')])).toEqual({ A: '2026-W45', B: '2026-W40' }))

const pasta = recept('pasta', [ing('crème fraîche', 100, 'ml')])
const wraps = recept('wraps', [ing('crème fraîche', 100, 'ml')])
const kaal = recept('kaal', [ing('ui', 1, 'stuk')])

test('restjes: aangebroken verpakking na afronden', () =>
  expect(restjes([{ receptId: 'pasta', dagen: 1 }], { pasta }, VP, 4)).toEqual({ 'crème fraîche': 100 }))

test('score: restjesbonus voor gerecht dat de rest opmaakt', () => {
  const rest = { 'crème fraîche': 100 }
  expect(score(wraps, W, {}, rest, VP, 4, 0.5)).toBeGreaterThan(score(kaal, W, {}, rest, VP, 4, 0.5))
})

test('restjesbonus: kiest een gerecht dat de aangebroken crème fraîche opmaakt', () => {
  const plannen = [gegeten('2026-W43', 'wraps', 'kaal')]
  for (const week of ['2026-W48', '2026-W49', '2026-W50', '2026-W51']) {
    const s = stelVoor([pasta, wraps, kaal], week, plannen, VP, 4).slice(0, 2)
    expect(s.map((x) => x.receptId)).toEqual(['pasta', 'wraps'])
  }
})

test('zelfde week, zelfde voorstel', () => expect(stelVoor(reeks(10), W, [], {}, 2)).toEqual(stelVoor(reeks(10), W, [], {}, 2)))

test('andere week mag een ander voorstel geven', () => {
  const voorstellen = new Set(['2026-W01', '2026-W02', '2026-W03', '2026-W04', '2026-W05'].map((w) => JSON.stringify(stelVoor(reeks(10), w, [], {}, 2))))
  expect(voorstellen.size).toBeGreaterThan(1)
})

test('plannen van de te plannen week zelf tellen niet als geschiedenis', () => {
  const s = stelVoor([recept('A', []), recept('B', [])], W, [gegeten(W, 'A'), gegeten('2026-W47', 'B')], {}, 2)
  expect(s[0].receptId).toBe('A')
})

test('vervang boven 5 dagen gooit "past niet"', () => {
  const slots = [1, 2, 3, 4].map((i) => ({ receptId: `r${i}`, dagen: 1 }))
  expect(() => vervang(slots, 0, recept('drie', [], { dagen: 3 }))).toThrow('past niet')
  expect(vervang(slots, 0, recept('twee', [], { dagen: 2 }))[0]).toEqual({ receptId: 'twee', dagen: 2 })
})

test('alternatieven: niet al in de week, alleen wat past', () => {
  const rs: Recept[] = [...reeks(6), recept('drie', [], { dagen: 3 })]
  const slots = [0, 1, 2, 3].map((i) => ({ receptId: `r${i}`, dagen: 1 }))
  const alt = alternatieven(0, slots, rs, W, [], {}, 2).map((r) => r.id)
  expect(alt.sort()).toEqual(['r4', 'r5'])
})
