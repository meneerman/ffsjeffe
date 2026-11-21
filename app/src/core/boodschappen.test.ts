import { expect, test } from 'vitest'
import { behoeften, boodschappenItems, boodschappenRegels, groepeerPerCategorie } from './boodschappen'
import { normaliseer } from './eenheden'
import { gerecht, ing, recept } from './testdata'

const pasta = recept('p', [ing('Pasta', 400, 'g'), ing('crème fraîche', 100, 'ml'), ing('peper')])
const wraps = recept('w', [ing('Crème Fraîche', 100, 'ml'), ing('peper'), ing('ui', 2, 'stuk')])
const soep = recept('s', [ing('ui', 100, 'g')], { porties: 2 })

test('normaliseer zet eenheden om naar basis', () => {
  expect(normaliseer(1, 'kg')).toEqual({ hoeveelheid: 1000, eenheid: 'g' })
  expect(normaliseer(2, 'el')).toEqual({ hoeveelheid: 30, eenheid: 'ml' })
  expect(normaliseer(3, null)).toEqual({ hoeveelheid: 3, eenheid: 'stuk' })
  expect(normaliseer(1, 'teentje')).toEqual({ hoeveelheid: 1, eenheid: 'teen' })
  expect(normaliseer(1, 'bosje')).toEqual({ hoeveelheid: 1, eenheid: 'bosje' })
})

test('schaalt per gerecht naar eters en avonden', () => {
  expect(behoeften([gerecht('p', 2)], { p: pasta })[0]).toEqual({ naam: 'pasta', hoeveelheid: 200, eenheid: 'g' })
  expect(behoeften([gerecht('p', 3)], { p: pasta })[0]).toEqual({ naam: 'pasta', hoeveelheid: 300, eenheid: 'g' })
  const stoof = recept('st', [ing('vlees', 400, 'g')])
  expect(behoeften([gerecht('st', 2, { avonden: 2 })], { st: stoof })[0].hoeveelheid).toBe(400)
  expect(behoeften([gerecht('st', 2, { avonden: 1 })], { st: stoof })[0].hoeveelheid).toBe(200)
})

test('telt op over gerechten met verschillende eters', () => {
  const b = behoeften([gerecht('p', 2), gerecht('w', 6)], { p: pasta, w: wraps })
  expect(b).toContainEqual({ naam: 'crème fraîche', hoeveelheid: 200, eenheid: 'ml' })
})

test('verschillende eenheden blijven aparte regels', () => {
  const b = behoeften([gerecht('w', 2), gerecht('s', 2)], { w: wraps, s: soep })
  expect(b.filter((x) => x.naam === 'ui')).toEqual([
    { naam: 'ui', hoeveelheid: 1, eenheid: 'stuk' },
    { naam: 'ui', hoeveelheid: 100, eenheid: 'g' },
  ])
})

test('naar smaak komt één keer zonder hoeveelheid', () => {
  const regels = boodschappenRegels(behoeften([gerecht('p'), gerecht('w')], { p: pasta, w: wraps }), {})
  expect(regels.filter((r) => r.startsWith('Peper'))).toEqual(['Peper'])
})

test('onbekend recept wordt overgeslagen', () => expect(behoeften([gerecht('weg')], {})).toEqual([]))

test('rondt af naar hele verpakkingen', () =>
  expect(boodschappenRegels([{ naam: 'crème fraîche', hoeveelheid: 250, eenheid: 'ml' }], { 'crème fraîche': { hoeveelheid: 200, eenheid: 'ml' } })).toEqual(['Crème fraîche 2× 200 ml']))

test('zonder verpakking: afgeronde hoeveelheid, stuks zonder woord, vaste eenheid met woord', () =>
  expect(boodschappenRegels([
    { naam: 'pasta', hoeveelheid: 233.4, eenheid: 'g' },
    { naam: 'ui', hoeveelheid: 1.5, eenheid: 'stuk' },
    { naam: 'knoflook', hoeveelheid: 2, eenheid: 'teen' },
  ], {})).toEqual(['Knoflook 2 teen', 'Pasta 234 g', 'Ui 2']))

test('"naar smaak" en een snufje gaan op in een echte hoeveelheid van hetzelfde ingrediënt', () => {
  const a = recept('a', [ing('olijfolie'), ing('zout'), ing('zout', 1, 'snuf'), ing('honing')])
  const b = recept('b', [ing('olijfolie', 30, 'ml'), ing('zout', 3, 'g')])
  const c = recept('c', [ing('olijfolie', 15, 'ml'), ing('honing')])
  const regels = (ids: string[]) => boodschappenRegels(behoeften(ids.map((id) => gerecht(id, 4)), { a, b, c }), {})
  expect(regels(['a', 'b', 'c'])).toEqual(['Honing', 'Olijfolie 45 ml', 'Zout 3 g'])
  expect(regels(['a'])).toEqual(['Honing', 'Olijfolie', 'Zout 1 snuf']) // alleen snuf + naar smaak: één regel
  expect(regels(['a', 'c'])).toEqual(['Honing', 'Olijfolie 15 ml', 'Zout 1 snuf'])
})

const verpakkingen = { 'crème fraîche': { hoeveelheid: 200, eenheid: 'ml' } }

test('boodschappenItems geeft dezelfde regels als boodschappenRegels, met de naam erbij', () => {
  const b = behoeften([gerecht('p', 4), gerecht('w', 4)], { p: pasta, w: wraps })
  const items = boodschappenItems(b, verpakkingen)
  expect(items.map((i) => i.regel)).toEqual(boodschappenRegels(b, verpakkingen))
  expect(items.find((i) => i.regel.startsWith('Crème'))).toEqual({ naam: 'crème fraîche', regel: 'Crème fraîche 1× 200 ml' })
})

test('groepeerPerCategorie: vaste volgorde, lege groepen weg, onbekend onder Overig, hoofdletterongevoelig', () => {
  const items = [
    { naam: 'Olijfolie', regel: 'Olijfolie 30 ml' },
    { naam: 'ui', regel: 'Ui 2' },
    { naam: 'mysterie', regel: 'Mysterie 1' },
    { naam: 'ui', regel: 'Ui 100 g' },
    { naam: 'melk', regel: 'Melk 1 l' },
  ]
  const c = { olijfolie: 'Olie, sauzen & azijn', ui: 'Groente & fruit', melk: 'Zuivel & eieren' } as const
  expect(groepeerPerCategorie(items, c).map((g) => [g.categorie, g.items.map((i) => i.regel)])).toEqual([
    ['Groente & fruit', ['Ui 100 g', 'Ui 2']],
    ['Zuivel & eieren', ['Melk 1 l']],
    ['Olie, sauzen & azijn', ['Olijfolie 30 ml']],
    ['Overig', ['Mysterie 1']],
  ])
  expect(groepeerPerCategorie([], {})).toEqual([])
})
