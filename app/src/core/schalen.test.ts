import { expect, test } from 'vitest'
import { schaalStap, toonHoeveelheid, toonIngredient } from './schalen'
import { schaalfactor } from './boodschappen'
import { ing, recept } from './testdata'

test('schaalfactor = eters × avonden / porties', () => {
  expect(schaalfactor(recept('r', [], { porties: 4, avonden: 2 }), 3)).toBe(1.5)
  expect(schaalfactor(recept('r', [], { porties: 4 }), 2)).toBe(0.5)
})

test('toonHoeveelheid: max 1 decimaal met komma', () => {
  expect(toonHoeveelheid(0.5)).toBe('0,5')
  expect(toonHoeveelheid(200)).toBe('200')
  expect(toonHoeveelheid(1 / 3)).toBe('0,3')
  expect(toonHoeveelheid(1.25)).toBe('1,3')
})

test('toonIngredient', () => {
  expect(toonIngredient(ing('pasta', 400, 'g'), 0.5)).toBe('200 g pasta')
  expect(toonIngredient(ing('zalmfilet', 2, 'stuk'), 0.5)).toBe('1 zalmfilet')
  expect(toonIngredient(ing('knoflook', 1, 'teen'), 2)).toBe('2 teen knoflook')
  expect(toonIngredient(ing('peper'), 3)).toBe('peper')
})

test('schaalStap', () => {
  expect(schaalStap('Kook {400 g} pasta 10 min', 0.5)).toBe('Kook 200 g pasta 10 min')
  expect(schaalStap('{2} eieren', 1.5)).toBe('3 eieren')
  expect(schaalStap('{veel} zout', 2)).toBe('veel zout')
  expect(schaalStap('{½ tl} zout', 2)).toBe('1 tl zout')
  expect(schaalStap('Roer {100 ml} room en {300 g} spinazie erdoor', 0.5)).toBe('Roer 50 ml room en 150 g spinazie erdoor')
  expect(schaalStap('zonder markering', 3)).toBe('zonder markering')
  expect(schaalStap('{2 stuk} uien', 1)).toBe('2 uien')
})

test('kookvriendelijk afronden per soort eenheid', () => {
  expect(toonIngredient(ing('knoflook', 1, 'teen'), 0.75)).toBe('1 teen knoflook')
  expect(toonIngredient(ing('zalmfilet', 2, 'stuk'), 0.75)).toBe('1,5 zalmfilet')
  expect(toonIngredient(ing('ui', 1, 'stuk'), 0.2)).toBe('0,5 ui')
  expect(toonIngredient(ing('olijfolie', 15, 'ml'), 0.75)).toBe('11 ml olijfolie')
  expect(toonIngredient(ing('zout', 3, 'g'), 0.75)).toBe('2,3 g zout')
  expect(schaalStap('Pers {1 teen} knoflook.', 0.75)).toBe('Pers 1 teen knoflook.')
})
