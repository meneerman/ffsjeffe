import { expect, test } from 'vitest'
import { behoeften, boodschappenRegels } from './boodschappen'
import { normaliseer } from './eenheden'
import { ing, recept } from './testdata'

const pasta = recept('p', [ing('Pasta', 400, 'g'), ing('crème fraîche', 100, 'ml'), ing('peper')])
const wraps = recept('w', [ing('Crème Fraîche', 100, 'ml'), ing('peper'), ing('ui', 2, 'stuk')])
const soep = recept('s', [ing('ui', 100, 'g')], { personen: 2 })

test('normaliseer zet eenheden om naar basis', () => {
  expect(normaliseer(1, 'kg')).toEqual({ hoeveelheid: 1000, eenheid: 'g' })
  expect(normaliseer(1, 'l')).toEqual({ hoeveelheid: 1000, eenheid: 'ml' })
  expect(normaliseer(2, 'dl')).toEqual({ hoeveelheid: 200, eenheid: 'ml' })
  expect(normaliseer(3, 'cl')).toEqual({ hoeveelheid: 30, eenheid: 'ml' })
  expect(normaliseer(2, 'el')).toEqual({ hoeveelheid: 30, eenheid: 'ml' })
  expect(normaliseer(1, 'tl')).toEqual({ hoeveelheid: 5, eenheid: 'ml' })
  expect(normaliseer(3, null)).toEqual({ hoeveelheid: 3, eenheid: 'stuk' })
  expect(normaliseer(1, 'bosje')).toEqual({ hoeveelheid: 1, eenheid: 'bosje' })
})

test('schaalt naar huishouden en dagen', () => {
  expect(behoeften([{ receptId: 'p', dagen: 1 }], { p: pasta }, 2)[0]).toEqual({ naam: 'pasta', hoeveelheid: 200, eenheid: 'g' })
  expect(behoeften([{ receptId: 'p', dagen: 2 }], { p: pasta }, 2)[0]).toEqual({ naam: 'pasta', hoeveelheid: 400, eenheid: 'g' })
})

test('telt hetzelfde ingrediënt over gerechten op', () => {
  const b = behoeften([{ receptId: 'p', dagen: 1 }, { receptId: 'w', dagen: 1 }], { p: pasta, w: wraps }, 4)
  expect(b).toContainEqual({ naam: 'crème fraîche', hoeveelheid: 200, eenheid: 'ml' })
})

test('verschillende eenheden blijven aparte regels', () => {
  const b = behoeften([{ receptId: 'w', dagen: 1 }, { receptId: 's', dagen: 1 }], { w: wraps, s: soep }, 2)
  expect(b.filter((x) => x.naam === 'ui')).toEqual([
    { naam: 'ui', hoeveelheid: 1, eenheid: 'stuk' },
    { naam: 'ui', hoeveelheid: 100, eenheid: 'g' },
  ])
})

test('el en tl worden ml, kg wordt g bij het optellen', () => {
  const r = recept('r', [ing('olie', 2, 'el'), ing('olie', 1, 'tl'), ing('meel', 0.5, 'kg')], { personen: 2 })
  expect(behoeften([{ receptId: 'r', dagen: 1 }], { r }, 2)).toEqual([
    { naam: 'olie', hoeveelheid: 35, eenheid: 'ml' },
    { naam: 'meel', hoeveelheid: 500, eenheid: 'g' },
  ])
})

test('naar smaak komt één keer zonder hoeveelheid', () => {
  const regels = boodschappenRegels(behoeften([{ receptId: 'p', dagen: 1 }, { receptId: 'w', dagen: 1 }], { p: pasta, w: wraps }, 2), {})
  expect(regels.filter((r) => r.startsWith('Peper'))).toEqual(['Peper'])
})

test('onbekend recept in een slot wordt overgeslagen', () =>
  expect(behoeften([{ receptId: 'weg', dagen: 1 }], {}, 2)).toEqual([]))

test('rondt af naar hele verpakkingen', () =>
  expect(boodschappenRegels([{ naam: 'crème fraîche', hoeveelheid: 250, eenheid: 'ml' }], { 'crème fraîche': { hoeveelheid: 200, eenheid: 'ml' } })).toEqual(['Crème fraîche 2× 200 ml']))

test('verpakking in andere maat wordt omgerekend', () =>
  expect(boodschappenRegels([{ naam: 'room', hoeveelheid: 300, eenheid: 'ml' }], { room: { hoeveelheid: 0.25, eenheid: 'l' } })).toEqual(['Room 2× 0.25 l']))

test('verpakking met andere soort eenheid wordt genegeerd', () =>
  expect(boodschappenRegels([{ naam: 'ui', hoeveelheid: 3, eenheid: 'stuk' }], { ui: { hoeveelheid: 1000, eenheid: 'g' } })).toEqual(['Ui 3']))

test('zonder verpakking: afgeronde hoeveelheid', () =>
  expect(boodschappenRegels([{ naam: 'pasta', hoeveelheid: 233.4, eenheid: 'g' }], {})).toEqual(['Pasta 234 g']))

test('geen afrondingsruis', () =>
  expect(boodschappenRegels([{ naam: 'pasta', hoeveelheid: 0.1 * 3 * 1000, eenheid: 'g' }], {})).toEqual(['Pasta 300 g']))

test('stuks zonder eenheidswoord', () =>
  expect(boodschappenRegels([{ naam: 'ui', hoeveelheid: 1.5, eenheid: 'stuk' }], {})).toEqual(['Ui 2']))

test('alfabetisch gesorteerd', () =>
  expect(boodschappenRegels([{ naam: 'ui', hoeveelheid: 1, eenheid: 'stuk' }, { naam: 'appel', hoeveelheid: 2, eenheid: 'stuk' }], {})).toEqual(['Appel 2', 'Ui 1']))
