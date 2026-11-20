import { expect, test } from 'vitest'
import type { Menu } from '../core/types'
import { leesVoorbeeld } from '../testhulp'
import { DataRepo, TokenFout, VerouderdFout, naarBase64, vanBase64 } from './github'

const BASE = 'https://api.github.com/repos/meneerman/ffsjeffe-data/'
const PASTA = 'Pasta met zalm en crème fraîche.md'
const WRAPS = 'Wraps met kip en crème fraîche.md'
const pad = (p: string) => `contents/${p.split('/').map(encodeURIComponent).join('/')}?ref=main`

type Antwoord = { status: number; body?: unknown }
function nepFetch(routes: Record<string, Antwoord>) {
  const verzoeken: { method: string; url: string; init?: RequestInit }[] = []
  const f = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    verzoeken.push({ method, url, init })
    const r = routes[`${method} ${url.replace(BASE, '')}`] ?? { status: 404, body: { message: 'Not Found' } }
    const tekst = typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? {})
    return new Response(tekst, { status: r.status })
  }) as typeof fetch
  return { f, verzoeken }
}
const repo = (routes: Record<string, Antwoord>) => {
  const n = nepFetch(routes)
  return { repo: new DataRepo({ owner: 'meneerman', repo: 'ffsjeffe-data', token: 'tok' }, n.f), verzoeken: n.verzoeken }
}
const bestand = (inhoud: string, sha = 'sha1') => ({ status: 200, body: { content: naarBase64(inhoud), sha } })

const MENU: Menu = {
  versie: 2, ronde: '2026-11-21T10:00:00.000Z', gerechten: [{ receptId: 'Pasta met zalm en crème fraîche', eters: 3, gegetenOp: null, vorigeKeer: null }],
  boodschappen: ['Crème fraîche 1× 200 ml'], vastgezetOp: '2026-11-21T10:00:00.000Z', door: 'Menno', leegmakenOp: null, laatstGegeten: {},
}
const MENUPAD = 'contents/weekmenu/menu.json'

test('base64 houdt UTF-8 heel', () => expect(vanBase64(naarBase64('crème fraîche'))).toBe('crème fraîche'))

test('recepten: titels met spaties en accenten, _-bestanden apart, fouten met reden', async () => {
  const { repo: r, verzoeken } = repo({
    'GET git/trees/main?recursive=1': { status: 200, body: { tree: [
      { path: `recepten/${PASTA}`, type: 'blob' }, { path: `recepten/${WRAPS}`, type: 'blob' },
      { path: 'recepten/Kapot.md', type: 'blob' }, { path: 'recepten/_verpakkingen.md', type: 'blob' },
      { path: 'recepten/_sjabloon.md', type: 'blob' }, { path: 'weekmenu/menu.json', type: 'blob' },
    ] } },
    [`GET ${pad(`recepten/${PASTA}`)}`]: bestand(leesVoorbeeld(PASTA)),
    [`GET ${pad(`recepten/${WRAPS}`)}`]: bestand(leesVoorbeeld(WRAPS)),
    [`GET ${pad('recepten/Kapot.md')}`]: bestand('geen frontmatter'),
    [`GET ${pad('recepten/_verpakkingen.md')}`]: bestand(leesVoorbeeld('_verpakkingen.md')),
  })
  const uit = await r.recepten()
  expect(uit.recepten.map((x) => x.titel).sort()).toEqual(['Pasta met zalm en crème fraîche', 'Wraps met kip en crème fraîche'])
  expect(uit.fouten).toEqual([{ pad: 'recepten/Kapot.md', fout: 'geen frontmatter' }])
  expect(uit.verpakkingen['crème fraîche']).toEqual({ hoeveelheid: 200, eenheid: 'ml' })
  expect(verzoeken.some((v) => v.url.includes('_sjabloon'))).toBe(false)
  expect((verzoeken[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  expect(verzoeken.every((v) => v.init?.cache === 'no-store')).toBe(true)
})

test('lege repo heeft geen recepten', async () => {
  const { repo: r } = repo({ 'GET git/trees/main?recursive=1': { status: 409 } })
  expect(await r.recepten()).toEqual({ recepten: [], fouten: [], verpakkingen: {} })
})

test('menu: null bij 404, v1 of kapotte JSON', async () => {
  expect(await repo({}).repo.menu()).toBeNull()
  expect(await repo({ [`GET ${MENUPAD}?ref=main`]: bestand('{"week": "2026-W48"}') }).repo.menu()).toBeNull()
  expect(await repo({ [`GET ${MENUPAD}?ref=main`]: bestand('{kapot') }).repo.menu()).toBeNull()
})

test('menu met sha', async () =>
  expect(await repo({ [`GET ${MENUPAD}?ref=main`]: bestand(JSON.stringify(MENU), 'abc') }).repo.menu()).toEqual({ menu: MENU, sha: 'abc' }))

test('zetMenu met sha en bericht', async () => {
  const { repo: r, verzoeken } = repo({ [`PUT ${MENUPAD}`]: { status: 200, body: { content: { sha: 'nieuw' } } } })
  expect(await r.zetMenu(MENU, 'oud', 'Menu vastgezet door Menno')).toBe('nieuw')
  const body = JSON.parse(verzoeken[0].init!.body as string)
  expect(body).toMatchObject({ sha: 'oud', branch: 'main', message: 'Menu vastgezet door Menno' })
  expect(JSON.parse(vanBase64(body.content))).toEqual(MENU)
})

test('zetMenu zonder sha', async () => {
  const { repo: r, verzoeken } = repo({ [`PUT ${MENUPAD}`]: { status: 201, body: { content: { sha: 'n' } } } })
  await r.zetMenu(MENU, null, 'x')
  expect('sha' in JSON.parse(verzoeken[0].init!.body as string)).toBe(false)
})

test('409 en 422-over-sha worden VerouderdFout, andere 422 niet', async () => {
  await expect(repo({ [`PUT ${MENUPAD}`]: { status: 409 } }).repo.zetMenu(MENU, 'o', 'x')).rejects.toBeInstanceOf(VerouderdFout)
  await expect(repo({ [`PUT ${MENUPAD}`]: { status: 422, body: { message: '"sha" wasn\'t supplied.' } } }).repo.zetMenu(MENU, null, 'x')).rejects.toBeInstanceOf(VerouderdFout)
  const andere = repo({ [`PUT ${MENUPAD}`]: { status: 422, body: { message: 'Invalid request' } } }).repo.zetMenu(MENU, 'o', 'x')
  await expect(andere).rejects.toThrow('GitHub gaf status 422')
  await expect(andere).rejects.not.toBeInstanceOf(VerouderdFout)
})

test('401 en 403 worden TokenFout', async () => {
  for (const status of [401, 403]) {
    await expect(repo({ 'GET git/trees/main?recursive=1': { status } }).repo.recepten()).rejects.toBeInstanceOf(TokenFout)
  }
})

test('instellingen en keepStatus', async () => {
  expect(await repo({}).repo.instellingen()).toEqual({ huishouden: 2 })
  expect(await repo({}).repo.keepStatus()).toBeNull()
})

test('vastzetten over een kapotte menu.json gebruikt de sha van dat bestand', async () => {
  const { repo: r, verzoeken } = repo({
    [`GET ${MENUPAD}?ref=main`]: bestand('{kapot', 'kapot-sha'),
    [`PUT ${MENUPAD}`]: { status: 200, body: { content: { sha: 'nieuw' } } },
  })
  expect(await r.menu()).toBeNull()
  await r.zetMenu(MENU, null, 'x')
  expect(JSON.parse(verzoeken.at(-1)!.init!.body as string).sha).toBe('kapot-sha')
})
