import { expect, test } from 'vitest'
import { alleGerechten, datumNL, leegmaken, markeerGegeten, migreer, vastzetten, verlooptNa, zaadVoor } from './menu'
import { gerecht, menuMet } from './testdata'
import type { MenuV2 } from './types'

const NU = new Date('2026-11-21T10:00:00.000Z')
const LATER = new Date('2026-11-23T09:00:00.000Z')
const B1 = '2026-11-01T10:00:00.000Z'
const basis = (extra = {}) => menuMet([gerecht('A')], { laatstGegeten: { A: '2026-10-01' }, ...extra }, { id: B1, vastgezetOp: B1, boodschappen: ['X'] })

test('datumNL in Amsterdam', () => {
  expect(datumNL(new Date('2026-11-20T23:30:00Z'))).toBe('2026-11-21')
  expect(datumNL(new Date('2026-11-20T12:00:00Z'))).toBe('2026-11-20')
})

test('migreer: versie 2 wordt één batch met id = ronde', () => {
  const v2: MenuV2 = { versie: 2, ronde: 'R', gerechten: [gerecht('A')], boodschappen: ['X'], vastgezetOp: 'V', door: 'P', leegmakenOp: 'L', laatstGegeten: { A: 'd' } }
  expect(migreer(v2)).toEqual({
    versie: 3, batches: [{ id: 'R', vastgezetOp: 'V', door: 'P', gerechten: [gerecht('A')], boodschappen: ['X'] }],
    leegmakenOp: 'L', laatstGegeten: { A: 'd' }, beoordelingen: {},
  })
})

test('migreer: een leeg versie 2 menu heeft geen batches; versie 3 blijft zoals het is', () => {
  expect(migreer({ versie: 2, ronde: 'R', gerechten: [], boodschappen: [], vastgezetOp: 'V', door: 'P', leegmakenOp: null, laatstGegeten: {} }).batches).toEqual([])
  const m = basis()
  expect(migreer(m)).toBe(m)
})

test('zaadVoor en verlooptNa', () => {
  expect(zaadVoor(null)).toBe('ffsjeffe')
  expect(zaadVoor(basis())).toBe(B1)
  expect(zaadVoor(basis({ leegmakenOp: 'L' }))).toBe('L')
  expect(verlooptNa(null)).toBeNull()
  expect(verlooptNa(basis())).toBe(B1)
  expect(verlooptNa(basis({ leegmakenOp: '2026-11-02T00:00:00.000Z' }))).toBe('2026-11-02T00:00:00.000Z')
  expect(verlooptNa(basis({ leegmakenOp: '2026-10-02T00:00:00.000Z' }))).toBe(B1)
})

test('vastzetten vanaf niets maakt één batch', () => {
  const m = vastzetten(null, [gerecht('A', 3)], ['Melk'], 'Menno', NU)
  expect(m).toEqual({
    versie: 3, batches: [{ id: NU.toISOString(), vastgezetOp: NU.toISOString(), door: 'Menno', gerechten: [gerecht('A', 3)], boodschappen: ['Melk'] }],
    leegmakenOp: null, laatstGegeten: {}, beoordelingen: {},
  })
})

test('vastzetten voegt een batch toe en laat bestaande batches ongemoeid', () => {
  const oud = basis({ leegmakenOp: 'L', beoordelingen: { A: 4 } })
  const m = vastzetten(oud, [gerecht('A', 4), gerecht('B')], ['Y'], 'M', NU)
  expect(m.batches).toHaveLength(2)
  expect(m.batches[0]).toEqual(oud.batches[0])
  expect(m.batches[1]).toMatchObject({ id: NU.toISOString(), gerechten: [gerecht('A', 4), gerecht('B')], boodschappen: ['Y'] })
  expect(m.laatstGegeten).toEqual(oud.laatstGegeten)
  expect(m.leegmakenOp).toBe('L')
  expect(m.beoordelingen).toEqual({ A: 4 })
  expect(alleGerechten(m)).toHaveLength(3)
})

test('markeerGegeten aan en weer uit', () => {
  const aan = markeerGegeten(basis(), B1, 'A', true, null, LATER)
  expect(aan.batches[0].gerechten[0]).toEqual(gerecht('A', 2, { gegetenOp: '2026-11-23', vorigeKeer: '2026-10-01' }))
  expect(aan.laatstGegeten.A).toBe('2026-11-23')
  expect(aan.batches[0].boodschappen).toEqual(['X'])
  expect(aan.beoordelingen).toEqual({})
  const uit = markeerGegeten(aan, B1, 'A', false, null, LATER)
  expect(uit.batches[0].gerechten[0]).toEqual(gerecht('A'))
  expect(uit.laatstGegeten.A).toBe('2026-10-01')
})

test('markeerGegeten bewaart de beoordeling en terugzetten laat hem staan', () => {
  const aan = markeerGegeten(basis(), B1, 'A', true, 4, LATER)
  expect(aan.beoordelingen).toEqual({ A: 4 })
  expect(markeerGegeten(aan, B1, 'A', false, null, LATER).beoordelingen).toEqual({ A: 4 })
  // zonder keuze blijft een eerdere beoordeling staan, 0 is een echte beoordeling
  expect(markeerGegeten(markeerGegeten(aan, B1, 'A', false, null, LATER), B1, 'A', true, null, LATER).beoordelingen).toEqual({ A: 4 })
  expect(markeerGegeten(basis(), B1, 'A', true, 0, LATER).beoordelingen).toEqual({ A: 0 })
})

test('markeerGegeten raakt alleen de gekozen batch als een recept in twee batches staat', () => {
  const twee = vastzetten(basis(), [gerecht('A')], [], 'M', NU)
  const m = markeerGegeten(twee, NU.toISOString(), 'A', true, null, LATER)
  expect(m.batches[0].gerechten[0].gegetenOp).toBeNull()
  expect(m.batches[1].gerechten[0].gegetenOp).toBe('2026-11-23')
})

test('terugzetten overschrijft geen nieuwere laatstGegeten van dezelfde recept in een andere batch', () => {
  const twee = vastzetten(basis(), [gerecht('A')], [], 'M', NU)
  const eerst = markeerGegeten(twee, B1, 'A', true, null, new Date('2026-11-22T10:00:00Z'))
  const daarna = markeerGegeten(eerst, NU.toISOString(), 'A', true, null, LATER)
  expect(markeerGegeten(daarna, B1, 'A', false, null, LATER).laatstGegeten.A).toBe('2026-11-23')
})

test('markeerGegeten uit zonder eerdere datum haalt laatstGegeten weg', () => {
  const m = basis({ laatstGegeten: {} })
  const uit = markeerGegeten(markeerGegeten(m, B1, 'A', true, null, LATER), B1, 'A', false, null, LATER)
  expect('A' in uit.laatstGegeten).toBe(false)
})

test('leegmaken leegt alle batches en houdt laatstGegeten en beoordelingen', () => {
  const m = leegmaken(basis({ beoordelingen: { A: 5 } }), NU)
  expect(m).toEqual({ versie: 3, batches: [], leegmakenOp: NU.toISOString(), laatstGegeten: { A: '2026-10-01' }, beoordelingen: { A: 5 } })
})
