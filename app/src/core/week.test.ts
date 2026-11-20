import { expect, test } from 'vitest'
import { indeling, isoWeek, maandagVan, teplannenWeek, weekVerschil } from './week'

test('isoWeek', () => {
  expect(isoWeek(new Date(2026, 10, 20))).toBe('2026-W47')
  expect(isoWeek(new Date(2027, 0, 1))).toBe('2026-W53')
  expect(isoWeek(new Date(2027, 0, 4))).toBe('2027-W01')
})

test('weekVerschil, ook over de jaargrens', () => {
  expect(weekVerschil('2026-W47', '2026-W48')).toBe(1)
  expect(weekVerschil('2026-W53', '2027-W01')).toBe(1)
  expect(weekVerschil('2026-W48', '2026-W48')).toBe(0)
})

test('maandagVan', () => {
  const m = maandagVan('2026-W48')
  expect([m.getFullYear(), m.getMonth(), m.getDate(), m.getDay()]).toEqual([2026, 10, 23, 1])
})

test('teplannenWeek: weekend = volgende week, doordeweeks = deze week', () => {
  expect(teplannenWeek(new Date(2026, 10, 21))).toBe('2026-W48')
  expect(teplannenWeek(new Date(2026, 10, 22))).toBe('2026-W48')
  expect(teplannenWeek(new Date(2026, 10, 18))).toBe('2026-W47')
  expect(teplannenWeek(new Date(2026, 10, 20))).toBe('2026-W47')
})

test('indeling met meerdaags gerecht', () =>
  expect(indeling([{ receptId: 'a', dagen: 1 }, { receptId: 'b', dagen: 2 }, { receptId: 'c', dagen: 1 }])).toEqual([
    { dag: 'ma', receptId: 'a', vervolg: false },
    { dag: 'di', receptId: 'b', vervolg: false },
    { dag: 'wo', receptId: 'b', vervolg: true },
    { dag: 'do', receptId: 'c', vervolg: false },
  ]))
