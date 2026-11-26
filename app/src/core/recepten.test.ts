import { expect, test } from 'vitest'
import { leesVoorbeeld } from '../testhulp'
import { parseHoeveelheid } from './eenheden'
import { parseCategorieen, parseRecept, parseRegel, parseVerpakkingen } from './recepten'
import type { Recept } from './types'

const PASTA = 'Pasta met zalm en crème fraîche.md'
const fout = (x: unknown) => typeof x === 'object' && x !== null && 'fout' in x
const recept = (fm: string, body = '') => parseRecept('recepten/X.md', `---\n${fm}\n---\n${body}`)

test('parseHoeveelheid', () => {
  expect(parseHoeveelheid('2')).toBe(2)
  expect(parseHoeveelheid('0,5')).toBe(0.5)
  expect(parseHoeveelheid('1.5')).toBe(1.5)
  expect(parseHoeveelheid('1/2')).toBe(0.5)
  expect(parseHoeveelheid('½')).toBe(0.5)
  expect(parseHoeveelheid('¼')).toBe(0.25)
  expect(parseHoeveelheid('¾')).toBe(0.75)
  expect(parseHoeveelheid('veel')).toBeNull()
  expect(parseHoeveelheid('1/0')).toBeNull()
})

test('parseRegel leest een getal direct aan de eenheid', () => {
  expect(parseRegel('400g pasta')).toEqual({ naam: 'pasta', hoeveelheid: 400, eenheid: 'g' })
  expect(parseRegel('1,5kg aardappelen')).toEqual({ naam: 'aardappelen', hoeveelheid: 1.5, eenheid: 'kg' })
  expect(parseRegel('500ml melk')).toEqual({ naam: 'melk', hoeveelheid: 500, eenheid: 'ml' })
})

test('parseRegel neemt bij een bereik het hoogste getal', () => {
  expect(parseRegel('2-3 tomaten')).toEqual({ naam: 'tomaten', hoeveelheid: 3, eenheid: 'stuk' })
  expect(parseRegel('2–3 el olie')).toEqual({ naam: 'olie', hoeveelheid: 3, eenheid: 'el' })
})

test('parseRegel geeft een fout bij een onleesbaar getal in plaats van stil de hoeveelheid te verliezen', () => {
  for (const regel of ['1½ tl zout', '1 1/2 el olie', '200gram pasta', '400g']) {
    expect(fout(parseRegel(regel)), regel).toBe(true)
  }
})

test('parseRegel laat een naam zonder getal ongemoeid', () => {
  expect(parseRegel('zout')).toEqual({ naam: 'zout', hoeveelheid: null, eenheid: null })
})

test('parseRegel', () => {
  expect(parseRegel('400 g pasta')).toEqual({ naam: 'pasta', hoeveelheid: 400, eenheid: 'g' })
  expect(parseRegel('2 zalmfilet')).toEqual({ naam: 'zalmfilet', hoeveelheid: 2, eenheid: 'stuk' })
  expect(parseRegel('2 rode uien')).toEqual({ naam: 'rode uien', hoeveelheid: 2, eenheid: 'stuk' })
  expect(parseRegel('1 teentje knoflook')).toEqual({ naam: 'knoflook', hoeveelheid: 1, eenheid: 'teen' })
  expect(parseRegel('½ bosje peterselie')).toEqual({ naam: 'peterselie', hoeveelheid: 0.5, eenheid: 'bosje' })
  expect(parseRegel('0,5 l melk')).toEqual({ naam: 'melk', hoeveelheid: 0.5, eenheid: 'l' })
  expect(parseRegel('  peper  ')).toEqual({ naam: 'peper', hoeveelheid: null, eenheid: null })
  expect(parseRegel('zout en peper')).toEqual({ naam: 'zout en peper', hoeveelheid: null, eenheid: null })
  expect(fout(parseRegel('400 g'))).toBe(true)
  expect(fout(parseRegel('2'))).toBe(true)
  expect(fout(parseRegel('  '))).toBe(true)
})

test('parseert het voorbeeldrecept', () => {
  const r = parseRecept(`recepten/${PASTA}`, leesVoorbeeld(PASTA)) as Recept
  expect(r.id).toBe('Pasta met zalm en crème fraîche')
  expect(r.titel).toBe('Pasta met zalm en crème fraîche')
  expect(r).toMatchObject({ porties: 4, tijdMinuten: 25, avonden: 1, bron: 'https://example.com/pasta-zalm' })
  expect(r.ingredienten).toHaveLength(7)
  expect(r.ingredienten[4]).toEqual({ naam: 'knoflook', hoeveelheid: 1, eenheid: 'teen' })
  expect(r.benodigdheden).toEqual(['knoflookpers'])
  expect(r.voorbereiding).toEqual([
    'Snijd {2} zalmfilets in blokjes van 2 cm.',
    'Pers {1 teen} knoflook.',
    'Breng een grote pan water met zout aan de kook.',
  ])
  expect(r.stappen).toHaveLength(6)
  expect(r.stappen[0]).toBe('Kook {400 g} pasta beetgaar volgens de verpakking.')
  expect(r.notities).toBe('Lekker met wat citroenrasp erover.')
})

test('standaardwaarden', () => {
  const r = recept('porties: 2\ningredienten: []') as Recept
  expect(r).toMatchObject({ tijdMinuten: 0, avonden: 1, bron: null, benodigdheden: [], voorbereiding: [], stappen: [], notities: '' })
})

test('bereiding stopt bij de volgende kop en negeert tekst buiten de lijst', () => {
  const r = recept('porties: 2\ningredienten: []', '## Bereiding\nIntro.\n1. Een.\n2. Twee\n\n## Variaties\n1. Niet dit.') as Recept
  expect(r.stappen).toEqual(['Een.', 'Twee'])
})

test('### binnen de bereiding geeft onderdelen; geen stap valt weg', () => {
  const r = recept('porties: 2\ningredienten: []', '## Bereiding\n0. Vooraf.\n\n### Saus\n1. Een.\n2. Twee.\n\n### Leeg\n\n### Vlees\n3. Drie.\n\n## Notities\n### Niet\n1. Niet dit.') as Recept
  expect(r.stappen).toEqual(['Vooraf.', 'Een.', 'Twee.', 'Drie.'])
  expect(r.onderdelen).toEqual([{ naam: 'Saus', vanaf: 1 }, { naam: 'Vlees', vanaf: 3 }])
})

test('zonder ### geen onderdelen', () => {
  const r = recept('porties: 2\ningredienten: []', '## Bereiding\n1. Een.') as Recept
  expect(r.onderdelen).toEqual([])
})

test('fouten met reden', () => {
  expect(parseRecept('recepten/X.md', 'alleen tekst')).toEqual({ pad: 'recepten/X.md', fout: 'geen frontmatter' })
  expect(recept('ingredienten: []')).toEqual({ pad: 'recepten/X.md', fout: 'porties ontbreekt of is geen geheel getal ≥ 1' })
  expect(fout(recept('porties: 0\ningredienten: []'))).toBe(true)
  expect(fout(recept('porties: 2\ningredienten: ui'))).toBe(true)
  expect(recept('porties: 2\ningredienten:\n  - 2 ui\n  - peper\n  - 400 g')).toEqual({ pad: 'recepten/X.md', fout: 'ingrediënt 3: "400 g" heeft geen naam' })
  expect(fout(recept('porties: 2\navonden: 0\ningredienten: []'))).toBe(true)
  expect(fout(recept('porties: [\n'))).toBe(true)
})

test('oud v1-formaat wordt een fout', () => {
  const v1 = 'titel: X\npersonen: 4\ningredienten:\n  - {naam: pasta, hoeveelheid: 400, eenheid: g}'
  expect(fout(recept(v1))).toBe(true)
})

test('bron alleen http(s)', () => {
  expect((recept('porties: 2\nbron: "javascript:alert(1)"\ningredienten: []') as Recept).bron).toBeNull()
  expect((recept('porties: 2\nbron: http://a.nl/x\ningredienten: []') as Recept).bron).toBe('http://a.nl/x')
})

test('verpakkingen als lijst van regels', () => {
  expect(parseVerpakkingen(leesVoorbeeld('_verpakkingen.md'))['crème fraîche']).toEqual({ hoeveelheid: 200, eenheid: 'ml' })
  expect(parseVerpakkingen('---\nverpakkingen:\n  - 200 ml Crème  Fraîche\n  - peper\n  - 400 g\n---\n')).toEqual({ 'crème fraîche': { hoeveelheid: 200, eenheid: 'ml' } })
  expect(parseVerpakkingen('niets')).toEqual({})
})

test('benodigdheden en voorbereiding mogen opsomming of genummerd zijn', () => {
  const r = recept('porties: 2\ningredienten: []', '## Benodigdheden\n* staafmixer\n- vijzel\n\n## Voorbereiding\n- Snipper de ui.\n- Weeg de bloem af.\n\n## Bereiding\n1. Bak.') as Recept
  expect(r.benodigdheden).toEqual(['staafmixer', 'vijzel'])
  expect(r.voorbereiding).toEqual(['Snipper de ui.', 'Weeg de bloem af.'])
  expect(r.stappen).toEqual(['Bak.'])
})

test('soort: standaard avondeten, vaste lijst, anders een fout', () => {
  expect((recept('porties: 2\ningredienten: []') as Recept).soort).toBe('avondeten')
  expect((recept('porties: 2\nsoort: toetje\ningredienten: []') as Recept).soort).toBe('toetje')
  expect((recept('porties: 2\nsoort: Ontbijt\ningredienten: []') as Recept).soort).toBe('ontbijt')
  expect(recept('porties: 2\nsoort: brunch\ningredienten: []')).toEqual({ pad: 'recepten/X.md', fout: 'soort moet een van ontbijt, lunch, avondeten, voorgerecht, toetje, snack zijn' })
})

test('invriezen: ja/nee/true/false, standaard nee, anders een fout', () => {
  expect((recept('porties: 2\ningredienten: []') as Recept).invriezen).toBe(false)
  expect((recept('porties: 2\ninvriezen: ja\ningredienten: []') as Recept).invriezen).toBe(true)
  expect((recept('porties: 2\ninvriezen: true\ningredienten: []') as Recept).invriezen).toBe(true)
  expect((recept('porties: 2\ninvriezen: nee\ningredienten: []') as Recept).invriezen).toBe(false)
  expect(recept('porties: 2\ninvriezen: misschien\ningredienten: []')).toEqual({ pad: 'recepten/X.md', fout: 'invriezen moet ja of nee zijn' })
})

test('parseCategorieen leest een map van categorie naar namen, met kleine letters als sleutel', () => {
  const md = '---\nGroente & fruit:\n  - Ui\n  - paprika\nOverig:\n  - zout\n---\nuitleg'
  expect(parseCategorieen(md)).toEqual({ ui: 'Groente & fruit', paprika: 'Groente & fruit', zout: 'Overig' })
})

test('parseCategorieen slaat onbekende categorieën en rommel over en geeft {} bij kapotte of ontbrekende frontmatter', () => {
  expect(parseCategorieen('---\nOnzin:\n  - ui\nZuivel & eieren:\n  - 5\n  - melk\n---\n')).toEqual({ melk: 'Zuivel & eieren' })
  expect(parseCategorieen('---\n: [kapot\n---\n')).toEqual({})
  expect(parseCategorieen('geen frontmatter')).toEqual({})
})

test('vooraf: korte tekst over wat een dag van tevoren moet gebeuren', () => {
  const r = (fm: string) => recept(`soort: avondeten\ninvriezen: nee\nporties: 4\ningredienten:\n  - 1 ui\n${fm}`, '## Bereiding\n1. Kook.')
  expect((r('vooraf: 24 uur marineren') as Recept).vooraf).toBe('24 uur marineren')
  expect((r('') as Recept).vooraf).toBeNull()
  expect((r('vooraf: ""') as Recept).vooraf).toBeNull()
  expect(fout(r('vooraf: 24'))).toBe(true)
  expect(fout(r(`vooraf: ${'x'.repeat(41)}`))).toBe(true)
})
