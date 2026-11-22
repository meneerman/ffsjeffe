import { expect, test } from 'vitest'
import { dagenGeleden, kandidaten, restjes, score } from './voorstel'
import { gerecht, ing, recept } from './testdata'

const NU = new Date('2026-11-21T12:00:00Z')
const VP = { 'crème fraîche': { hoeveelheid: 200, eenheid: 'ml' } }
const reeks = (n: number) => Array.from({ length: n }, (_, i) => recept(`r${i}`, [ing('ui', 1, 'stuk')]))

test('dagenGeleden in kalenderdagen', () => {
  expect(dagenGeleden('2026-11-01', NU)).toBe(20)
  expect(dagenGeleden('2026-11-21', NU)).toBe(0)
  expect(dagenGeleden('2026-11-21', new Date('2026-11-21T23:30:00Z'))).toBe(1) // al 22 nov in Amsterdam
})

test('lang niet gegeten gaat voor', () => {
  const k = kandidaten([], [recept('A', []), recept('B', [])], { A: '2026-11-20', B: '2026-09-01' }, {}, 2, 'z', NU)
  expect(k[0].id).toBe('B')
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
    expect(kandidaten([gerecht('pasta', 4)], [pasta, wraps, kaal], gegeten, VP, 4, zaad, NU)[0].id).toBe('wraps')
  }
})

test('zelfde zaad zelfde volgorde, ander zaad mag anders', () => {
  const volgorde = (z: string) => kandidaten([], reeks(10), {}, {}, 2, z, NU).map((r) => r.id)
  expect(volgorde('x')).toEqual(volgorde('x'))
  const set = new Set(['a', 'b', 'c', 'd', 'e'].map((z) => JSON.stringify(volgorde(z))))
  expect(set.size).toBeGreaterThan(1)
})

test('kandidaten sluiten het menu uit, beste eerst', () => {
  const k = kandidaten([gerecht('A')], [recept('A', []), recept('B', []), recept('C', [])], { B: '2026-11-20' }, {}, 2, 'z', NU)
  expect(k.map((r) => r.id).sort()).toEqual(['B', 'C'])
  expect(k[0].id).toBe('C')
})

test('kandidaten gebruiken alleen avondeten', () => {
  const rs = [recept('Toetje', [], { soort: 'toetje' }), recept('Ontbijt', [], { soort: 'ontbijt' }), recept('Diner', [])]
  expect(kandidaten([], rs, {}, {}, 4, 'z', NU).map((r) => r.id)).toEqual(['Diner'])
})
