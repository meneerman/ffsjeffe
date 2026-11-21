import { expect, test } from 'vitest'
import { pakOp } from './pakop'
import { gerecht, ing, recept } from './testdata'

const VP = {
  'half om half gehakt': { hoeveelheid: 500, eenheid: 'g' },
  passata: { hoeveelheid: 500, eenheid: 'g' },
  'griekse yoghurt': { hoeveelheid: 500, eenheid: 'g' },
  kokosmelk: { hoeveelheid: 400, eenheid: 'ml' },
  ui: { hoeveelheid: 3, eenheid: 'stuk' },
}
const bolo = recept('Bolo', [ing('half om half gehakt', 750, 'g'), ing('passata', 500, 'g'), ing('ui', 5, 'stuk')], { porties: 12, avonden: 3 })
const oats = recept('Oats', [ing('Griekse yoghurt', 100, 'g')], { porties: 1 })
const tomkha = recept('Tom kha', [ing('kokosmelk', 800, 'ml')], { porties: 4 })

test('bolognese: gehakt op bij 16 porties, via avonden (4 × 4)', () => {
  expect(pakOp(bolo, gerecht('Bolo', 4, { avonden: 3 }), VP)).toEqual({ naam: 'half om half gehakt', porties: 16, eters: 4, avonden: 4 })
})

test('oats: yoghurt op bij 5 porties, via eters (geen veelvoud van 4)', () => {
  expect(pakOp(oats, gerecht('Oats', 4), VP)).toEqual({ naam: 'Griekse yoghurt', porties: 5, eters: 5, avonden: 1 })
})

test('geen tip als het pak al (bijna) op is', () => {
  expect(pakOp(tomkha, gerecht('Tom kha', 4), VP)).toBeNull()
})

test('geen tip als het pas veel verder op is (meer dan ± anderhalf keer)', () => {
  const avocado = recept('Avo', [ing('Griekse yoghurt', 75, 'g')], { porties: 2 }) // 150 g bij 4 → rest 350; op pas bij 6,7 porties
  expect(pakOp(avocado, gerecht('Avo', 4), VP)).toBeNull()
})

test('stuks en ingrediënten zonder verpakking tellen niet als hoofdingrediënt', () => {
  const r = recept('Uien', [ing('ui', 5, 'stuk'), ing('rijst', 500, 'g')], { porties: 4 })
  expect(pakOp(r, gerecht('Uien', 4), VP)).toBeNull()
})

test('na het toepassen geeft dezelfde regel geen nieuwe tip meer', () => {
  expect(pakOp(bolo, gerecht('Bolo', 4, { avonden: 4 }), VP)).toBeNull()
})
