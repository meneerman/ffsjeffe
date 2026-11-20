import { expect, test } from 'vitest'
import { datumNL, leegmaken, markeerGegeten, vastzetten, zaadVoor } from './menu'
import { gerecht } from './testdata'
import type { Menu } from './types'

const NU = new Date('2026-11-21T10:00:00.000Z')
const LATER = new Date('2026-11-23T09:00:00.000Z')
const basis = (extra: Partial<Menu> = {}): Menu => ({
  versie: 2, ronde: '2026-11-01T10:00:00.000Z', gerechten: [gerecht('A')], boodschappen: ['X'],
  vastgezetOp: '2026-11-01T10:00:00.000Z', door: 'P', leegmakenOp: null, laatstGegeten: { A: '2026-10-01' }, ...extra,
})

test('datumNL in Amsterdam', () => {
  expect(datumNL(new Date('2026-11-20T23:30:00Z'))).toBe('2026-11-21')
  expect(datumNL(new Date('2026-11-20T12:00:00Z'))).toBe('2026-11-20')
})

test('zaadVoor', () => {
  expect(zaadVoor(null)).toBe('ffsjeffe')
  expect(zaadVoor(basis())).toBe('2026-11-01T10:00:00.000Z')
  expect(zaadVoor(basis({ leegmakenOp: 'L' }))).toBe('L')
})

test('vastzetten vanaf niets of een leeg menu begint een nieuwe ronde', () => {
  const m = vastzetten(null, [gerecht('A', 3)], ['Melk'], 'Menno', NU)
  expect(m).toEqual({ versie: 2, ronde: NU.toISOString(), gerechten: [gerecht('A', 3)], boodschappen: ['Melk'], vastgezetOp: NU.toISOString(), door: 'Menno', leegmakenOp: null, laatstGegeten: {} })
  expect(vastzetten(basis({ gerechten: [] }), [gerecht('A')], [], 'M', NU).ronde).toBe(NU.toISOString())
})

test('vastzetten bij een niet-leeg menu houdt de ronde, laatstGegeten en gegeten-status', () => {
  const oud = basis({ gerechten: [gerecht('A', 2, { gegetenOp: '2026-11-20', vorigeKeer: '2026-10-01' })], leegmakenOp: 'L' })
  const m = vastzetten(oud, [gerecht('A', 4), gerecht('B')], ['Y'], 'M', NU)
  expect(m.ronde).toBe(oud.ronde)
  expect(m.laatstGegeten).toEqual(oud.laatstGegeten)
  expect(m.leegmakenOp).toBe('L')
  expect(m.gerechten).toEqual([gerecht('A', 4, { gegetenOp: '2026-11-20', vorigeKeer: '2026-10-01' }), gerecht('B')])
})

test('markeerGegeten aan en weer uit', () => {
  const aan = markeerGegeten(basis(), 'A', true, LATER)
  expect(aan.gerechten[0]).toEqual(gerecht('A', 2, { gegetenOp: '2026-11-23', vorigeKeer: '2026-10-01' }))
  expect(aan.laatstGegeten.A).toBe('2026-11-23')
  expect(aan.boodschappen).toEqual(['X'])
  expect(aan.vastgezetOp).toBe(basis().vastgezetOp)
  const uit = markeerGegeten(aan, 'A', false, LATER)
  expect(uit.gerechten[0]).toEqual(gerecht('A'))
  expect(uit.laatstGegeten.A).toBe('2026-10-01')
})

test('markeerGegeten uit zonder eerdere datum haalt laatstGegeten weg', () => {
  const m = basis({ laatstGegeten: {} })
  const uit = markeerGegeten(markeerGegeten(m, 'A', true, LATER), 'A', false, LATER)
  expect('A' in uit.laatstGegeten).toBe(false)
})

test('leegmaken', () => {
  const m = leegmaken(basis(), 'Menno', NU)
  expect(m).toMatchObject({ gerechten: [], boodschappen: [], leegmakenOp: NU.toISOString(), vastgezetOp: NU.toISOString(), door: 'Menno', laatstGegeten: { A: '2026-10-01' }, ronde: basis().ronde })
  expect(leegmaken(null, 'M', NU).ronde).toBe(NU.toISOString())
})
