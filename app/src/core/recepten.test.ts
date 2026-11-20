import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { parseRecept, parseVerpakkingen } from './recepten'
import type { Recept } from './types'

const VOORBEELD = readFileSync(new URL('../../../data-template/recepten/pasta-zalm.md', import.meta.url), 'utf8')
const fout = (x: unknown) => typeof x === 'object' && x !== null && 'fout' in x

test('parseert een geldig recept met standaardwaarden', () => {
  const r = parseRecept('recepten/pasta-zalm.md', VOORBEELD) as Recept
  expect(r.id).toBe('pasta-zalm')
  expect(r.titel).toBe('Pasta met zalm en crème fraîche')
  expect(r.dagen).toBe(1)
  expect(r.personen).toBe(4)
  expect(r.tijdMinuten).toBe(25)
  expect(r.bron).toBe('https://example.com/pasta-zalm')
  expect(r.ingredienten[2]).toEqual({ naam: 'crème fraîche', hoeveelheid: 100, eenheid: 'ml' })
  expect(r.ingredienten[4]).toEqual({ naam: 'peper', hoeveelheid: null, eenheid: null })
  expect(r.bereiding.trim()).toMatch(/^Kook de pasta\./)
})

test('optionele velden krijgen standaardwaarden', () => {
  const r = parseRecept('recepten/x.md', '---\ntitel: X\npersonen: 2\ningredienten:\n  - {naam: ui}\n---\n') as Recept
  expect(r).toMatchObject({ dagen: 1, tijdMinuten: 0, bron: null, bereiding: '' })
})

test('ontbrekende titel geeft een fout met pad', () =>
  expect(parseRecept('recepten/x.md', '---\npersonen: 2\ningredienten: []\n---\n')).toEqual({ pad: 'recepten/x.md', fout: 'titel ontbreekt' }))

test('ingredienten geen lijst geeft een fout', () =>
  expect(fout(parseRecept('recepten/x.md', '---\ntitel: X\npersonen: 2\ningredienten: ui\n---\n'))).toBe(true))

test('ingrediënt zonder naam geeft een fout', () =>
  expect(fout(parseRecept('recepten/x.md', '---\ntitel: X\npersonen: 2\ningredienten:\n  - {hoeveelheid: 2}\n---\n'))).toBe(true))

test('personen ontbreekt of is 0 geeft een fout', () =>
  expect(fout(parseRecept('recepten/x.md', '---\ntitel: X\npersonen: 0\ningredienten: []\n---\n'))).toBe(true))

test('dagen buiten 1–5 geeft een fout', () =>
  expect(fout(parseRecept('recepten/x.md', '---\ntitel: X\npersonen: 2\ndagen: 6\ningredienten: []\n---\n'))).toBe(true))

test('kapotte YAML geeft een fout, geen exceptie', () =>
  expect(fout(parseRecept('recepten/x.md', '---\ntitel: [\n---\n'))).toBe(true))

test('geen frontmatter geeft een fout', () =>
  expect(fout(parseRecept('recepten/x.md', 'alleen tekst'))).toBe(true))

test('verpakkingen op genormaliseerde naam', () =>
  expect(parseVerpakkingen('---\nverpakkingen:\n  Crème  Fraîche: {hoeveelheid: 200, eenheid: ml}\n---\n')).toEqual({
    'crème fraîche': { hoeveelheid: 200, eenheid: 'ml' },
  }))

test('verpakkingenbestand zonder frontmatter geeft leeg', () => expect(parseVerpakkingen('niets')).toEqual({}))
