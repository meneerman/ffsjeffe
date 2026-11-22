import { expect, test } from 'vitest'
import { ing, recept } from './testdata'
import { zoekRecepten } from './zoeken'

const stoof = recept('Stoofpot', [ing('rundvlees', 500, 'g'), ing('wortel', 200, 'g'), ing('crème fraîche', 100, 'ml')])
const pasta = recept('Pasta met broccoli', [ing('pasta', 400, 'g'), ing('broccoliroosjes', 300, 'g'), ing('knoflook', 2, 'teen')])
const curry = recept('Curry', [ing('broccoli', 250, 'g'), ing('kokosmelk', 400, 'ml'), ing('rode ui', 1, 'stuk')])
const alle = [stoof, pasta, curry]
const ids = (t: string) => zoekRecepten(alle, t)?.map((x) => x.recept.id)

test('lege zoekterm: geen filter (null)', () => {
  expect(zoekRecepten(alle, '')).toBeNull()
  expect(zoekRecepten(alle, '   ,  ')).toBeNull()
})

test('houdt alleen recepten met het ingrediënt, ook als deel van een woord', () => {
  expect(ids('broccoli')).toEqual(['Pasta met broccoli', 'Curry'])
  expect(zoekRecepten(alle, 'broccoli')![0].treffers).toEqual(['broccoliroosjes'])
  expect(zoekRecepten(alle, 'broccoli')![1].treffers).toEqual(['broccoli'])
})

test('hoofdletters en accenten maken niet uit', () => {
  expect(ids('CREME')).toEqual(['Stoofpot'])
  expect(ids('crème')).toEqual(['Stoofpot'])
})

test('meerdere ingrediënten (spatie of komma) moeten allemaal voorkomen', () => {
  expect(ids('broccoli knoflook')).toEqual(['Pasta met broccoli'])
  expect(ids('broccoli, rode ui')).toEqual(['Curry'])
  expect(ids('broccoli rundvlees')).toEqual([])
})

test('meervoud van wat je intikt vindt het enkelvoud', () => {
  expect(ids('uien')).toEqual(['Curry'])
  expect(ids('wortels')).toEqual(['Stoofpot'])
})

test('de titel telt ook mee', () => {
  expect(ids('stoofpot')).toEqual(['Stoofpot'])
})
