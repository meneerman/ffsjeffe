import { expect, test } from 'vitest'
import { dagenGeleden, kandidaten, restjes, score, stelVoor, vervang } from './voorstel'
import { gerecht, ing, recept } from './testdata'

const NU = new Date('2026-11-21T12:00:00Z')
const VP = { 'crème fraîche': { hoeveelheid: 200, eenheid: 'ml' } }
const reeks = (n: number) => Array.from({ length: n }, (_, i) => recept(`r${i}`, [ing('ui', 1, 'stuk')]))

test('dagenGeleden in kalenderdagen', () => {
  expect(dagenGeleden('2026-11-01', NU)).toBe(20)
  expect(dagenGeleden('2026-11-21', NU)).toBe(0)
  expect(dagenGeleden('2026-11-21', new Date('2026-11-21T23:30:00Z'))).toBe(1) // al 22 nov in Amsterdam
})

test('stelt standaard 3 gerechten voor met standaard eters', () => {
  const v = stelVoor(reeks(10), {}, {}, 2, 'zaad', NU)
  expect(v).toHaveLength(3)
  expect(v.every((g) => g.eters === 2 && g.avonden === 1 && g.gegetenOp === null && g.vorigeKeer === null)).toBe(true)
  expect(stelVoor([recept('Batch', [], { avonden: 3 })], {}, {}, 4, 'z', NU)).toEqual([{ receptId: 'Batch', eters: 4, avonden: 3, gegetenOp: null, vorigeKeer: null }])
  expect(new Set(v.map((g) => g.receptId)).size).toBe(3)
})

test('aantal is instelbaar en minder recepten = korter', () => {
  expect(stelVoor(reeks(10), {}, {}, 2, 'z', NU, 5)).toHaveLength(5)
  expect(stelVoor(reeks(2), {}, {}, 2, 'z', NU)).toHaveLength(2)
  expect(stelVoor([], {}, {}, 2, 'z', NU)).toEqual([])
})

test('lang niet gegeten gaat voor', () => {
  const v = stelVoor([recept('A', []), recept('B', [])], { A: '2026-11-20', B: '2026-09-01' }, {}, 2, 'z', NU, 1)
  expect(v[0].receptId).toBe('B')
})

const pasta = recept('pasta', [ing('crème fraîche', 100, 'ml')])
const wraps = recept('wraps', [ing('crème fraîche', 100, 'ml')])
const kaal = recept('kaal', [ing('ui', 1, 'stuk')])

test('restjes na afronden op verpakkingen', () =>
  expect(restjes([gerecht('pasta', 4)], { pasta }, VP)).toEqual({ 'crème fraîche': 100 }))

test('score: restjesbonus', () => {
  const rest = { 'crème fraîche': 100 }
  expect(score(wraps, {}, NU, rest, VP, 4, 0.5)).toBeGreaterThan(score(kaal, {}, NU, rest, VP, 4, 0.5))
})

test('restjesbonus kiest het gerecht dat de aangebroken crème fraîche opmaakt', () => {
  const gegeten = { wraps: '2026-10-17', kaal: '2026-10-17' }
  for (const zaad of ['a', 'b', 'c', 'd']) {
    expect(stelVoor([pasta, wraps, kaal], gegeten, VP, 4, zaad, NU, 2).map((g) => g.receptId)).toEqual(['pasta', 'wraps'])
  }
})

test('zelfde zaad zelfde voorstel, ander zaad mag anders', () => {
  expect(stelVoor(reeks(10), {}, {}, 2, 'x', NU)).toEqual(stelVoor(reeks(10), {}, {}, 2, 'x', NU))
  const set = new Set(['a', 'b', 'c', 'd', 'e'].map((z) => JSON.stringify(stelVoor(reeks(10), {}, {}, 2, z, NU))))
  expect(set.size).toBeGreaterThan(1)
})

test('kandidaten sluiten het menu uit, beste eerst', () => {
  const k = kandidaten([gerecht('A')], [recept('A', []), recept('B', []), recept('C', [])], { B: '2026-11-20' }, {}, 2, 'z', NU)
  expect(k.map((r) => r.id).sort()).toEqual(['B', 'C'])
  expect(k[0].id).toBe('C')
})

test('voorstel en kandidaten gebruiken alleen avondeten', () => {
  const rs = [recept('Toetje', [], { soort: 'toetje' }), recept('Ontbijt', [], { soort: 'ontbijt' }), recept('Diner', [])]
  expect(stelVoor(rs, {}, {}, 4, 'z', NU).map((g) => g.receptId)).toEqual(['Diner'])
  expect(kandidaten([], rs, {}, {}, 4, 'z', NU).map((r) => r.id)).toEqual(['Diner'])
})

test('vervang: volgende beste op dezelfde plek, eters en avonden blijven', () => {
  const rs = [recept('A', []), recept('B', []), recept('C', []), recept('D', [], { avonden: 3 })]
  const laatst = { A: '2026-11-20', B: '2026-10-01', C: '2026-11-10', D: '2026-08-01' }
  const menu = [gerecht('A', 5, { avonden: 2 }), gerecht('B', 3)]
  const nieuw = vervang(menu, 'A', rs, laatst, {}, 4, 'z', NU, new Set())!
  expect(nieuw).toHaveLength(2)
  expect(nieuw[0]).toMatchObject({ receptId: 'D', eters: 5, avonden: 2, gegetenOp: null }) // beste die nog niet op het menu staat
  expect(nieuw[1]).toEqual(menu[1])
})

test('vervang slaat al weggeveegde recepten over; geen alternatief = null', () => {
  const rs = [recept('A', []), recept('B', []), recept('C', [])]
  const laatst = { A: '2026-11-20', B: '2026-09-01', C: '2026-10-01' }
  expect(vervang([gerecht('A')], 'A', rs, laatst, {}, 2, 'z', NU, new Set(['B']))![0].receptId).toBe('C')
  expect(vervang([gerecht('A')], 'A', rs, laatst, {}, 2, 'z', NU, new Set(['B', 'C']))).toBeNull()
  expect(vervang([gerecht('A')], 'A', [recept('A', [])], {}, {}, 2, 'z', NU, new Set())).toBeNull()
  expect(vervang([gerecht('A')], 'weg', rs, laatst, {}, 2, 'z', NU, new Set())).toBeNull()
})
