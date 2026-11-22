import { expect, test } from 'vitest'
import { parseWinkels, buitenAh, buitenLidl } from './winkels'

const md = "---\nniet-lidl:\n  - Za'atar\n  - gochujang\nniet-ah:\n  - djeroek poeroet-blaadjes\n---\nuitleg"

test('parseWinkels leest wat niet bij Lidl en niet bij Albert Heijn te koop is', () => {
  const w = parseWinkels(md)
  expect(buitenLidl("za'atar", w)).toBe(true)
  expect(buitenLidl('Gochujang', w)).toBe(true)
  expect(buitenLidl('ui', w)).toBe(false)
  expect(buitenAh('gochujang', w)).toBe(false)
  expect(buitenAh('djeroek poeroet-blaadjes', w)).toBe(true)
})

test('wat niet bij de Albert Heijn is, is ook niet bij Lidl (bij Lidl = ook bij AH)', () => {
  const w = parseWinkels(md)
  expect(buitenLidl('djeroek poeroet-blaadjes', w)).toBe(true)
})

test('kapot of leeg bestand: alles gewoon te koop', () => {
  for (const x of ['', 'geen frontmatter', '---\n: [kapot\n---\n', '---\nniet-lidl: 5\n---\n']) {
    const w = parseWinkels(x)
    expect(buitenLidl('ui', w)).toBe(false)
    expect(buitenAh('ui', w)).toBe(false)
  }
})
