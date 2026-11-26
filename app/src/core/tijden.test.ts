import { expect, test } from 'vitest'
import { tijden } from './tijden'

const s = (t: string) => tijden(t).map((x) => x.seconden)

test('minuten, uren, seconden en woorden', () => {
  expect(tijden('Gril de spiesen ongeveer 7 min op de barbecue.')).toEqual([{ label: '7 min', seconden: 420 }])
  expect(tijden('Laat minimaal 3 uur pruttelen.')).toEqual([{ label: '3 uur', seconden: 10800 }])
  expect(tijden('Kook 1,5 min.')).toEqual([{ label: '1,5 min', seconden: 90 }])
  expect(tijden('Roer 30 seconden.')).toEqual([{ label: '30 sec', seconden: 30 }])
  expect(s('Week de spiesen een half uur in water.')).toEqual([1800])
  expect(s('Laat een kwartier staan.')).toEqual([900])
  expect(s('Bak nog een minuutje mee.')).toEqual([60])
})

test('bij een bereik telt de laagste waarde', () => {
  expect(s('Bak 8 tot 10 min.')).toEqual([480])
  expect(s('Bak 2 à 3 minuten.')).toEqual([120])
  expect(s('Kook 1 tot 1,5 uur zachtjes.')).toEqual([3600])
  expect(s('Bak 10-15 min.')).toEqual([600])
})

test('meerdere tijden: elk één keer', () => {
  expect(s('Bak 5 min, keer om en bak nog 5 min. Laat 2 min rusten.')).toEqual([300, 120])
})

test('geen tijd: maten, hoeveelheden, een nacht en hele dagen', () => {
  expect(s('Snijd plakjes van 5 mm.')).toEqual([])
  expect(s('Voeg {2 tl} zout toe.')).toEqual([])
  expect(s('Zet een nacht in de koelkast, of een paar uur.')).toEqual([])
  expect(s('Marineer 24 uur.')).toEqual([])
  expect(s('Verwarm de oven op 200 °C.')).toEqual([])
})
