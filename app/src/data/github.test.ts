import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import type { WeekPlan } from '../core/types'
import { DataRepo, TokenFout, VerouderdFout, naarBase64, vanBase64 } from './github'

const BASE = 'https://api.github.com/repos/meneerman/ffsjeffe-data/'
const lees = (f: string) => readFileSync(new URL(`../../../data-template/recepten/${f}`, import.meta.url), 'utf8')

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

const PLAN: WeekPlan = { week: '2026-W48', status: 'vastgezet', slots: [{ receptId: 'pasta-zalm', dagen: 1 }], boodschappen: ['Crème fraîche 1× 200 ml'], vastgezetOp: '2026-11-21T10:00:00+01:00', door: 'Menno' }

test('base64 houdt UTF-8 heel', () => expect(vanBase64(naarBase64('crème fraîche'))).toBe('crème fraîche'))
test('base64 met regeleinden (zoals GitHub levert)', () => expect(vanBase64(naarBase64('x'.repeat(200)).replace(/(.{60})/g, '$1\n'))).toBe('x'.repeat(200)))

test('recepten: geldige, fouten en verpakkingen apart', async () => {
  const { repo: r, verzoeken } = repo({
    'GET git/trees/main?recursive=1': { status: 200, body: { tree: [
      { path: 'recepten/pasta-zalm.md', type: 'blob' }, { path: 'recepten/wraps-kip.md', type: 'blob' },
      { path: 'recepten/kapot.md', type: 'blob' }, { path: 'recepten/_verpakkingen.md', type: 'blob' },
      { path: 'recepten', type: 'tree' }, { path: 'weekmenu/instellingen.json', type: 'blob' },
    ] } },
    'GET contents/recepten/pasta-zalm.md?ref=main': bestand(lees('pasta-zalm.md')),
    'GET contents/recepten/wraps-kip.md?ref=main': bestand(lees('wraps-kip.md')),
    'GET contents/recepten/kapot.md?ref=main': bestand('geen frontmatter'),
    'GET contents/recepten/_verpakkingen.md?ref=main': bestand(lees('_verpakkingen.md')),
  })
  const uit = await r.recepten()
  expect(uit.recepten.map((x) => x.id).sort()).toEqual(['pasta-zalm', 'wraps-kip'])
  expect(uit.fouten).toEqual([{ pad: 'recepten/kapot.md', fout: 'geen frontmatter' }])
  expect(uit.verpakkingen['crème fraîche']).toEqual({ hoeveelheid: 200, eenheid: 'ml' })
  expect((verzoeken[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
})

test('recepten in een lege repo', async () => {
  const { repo: r } = repo({ 'GET git/trees/main?recursive=1': { status: 409, body: { message: 'Git Repository is empty.' } } })
  expect(await r.recepten()).toEqual({ recepten: [], fouten: [], verpakkingen: {} })
})

test('plannen met sha', async () => {
  const { repo: r } = repo({
    'GET git/trees/main?recursive=1': { status: 200, body: { tree: [{ path: 'weekmenu/plannen/2026-W48.json', type: 'blob' }] } },
    'GET contents/weekmenu/plannen/2026-W48.json?ref=main': bestand(JSON.stringify(PLAN), 'abc'),
  })
  expect(await r.plannen()).toEqual([{ plan: PLAN, sha: 'abc' }])
})

test('instellingen: standaard bij 404', async () => expect(await repo({}).repo.instellingen()).toEqual({ huishouden: 2 }))
test('instellingen uit bestand', async () =>
  expect(await repo({ 'GET contents/weekmenu/instellingen.json?ref=main': bestand('{"huishouden": 3}') }).repo.instellingen()).toEqual({ huishouden: 3 }))

test('keepStatus: null bij 404, anders inhoud', async () => {
  expect(await repo({}).repo.keepStatus()).toBeNull()
  const s = { tijd: '2026-11-21T10:01:00+01:00', ok: true, melding: '', weken: ['2026-W48'] }
  expect(await repo({ 'GET contents/weekmenu/keep-status.json?ref=main': bestand(JSON.stringify(s)) }).repo.keepStatus()).toEqual(s)
})

test('zetVast stuurt plan met sha en geeft nieuwe sha', async () => {
  const { repo: r, verzoeken } = repo({ 'PUT contents/weekmenu/plannen/2026-W48.json': { status: 200, body: { content: { sha: 'nieuw' } } } })
  expect(await r.zetVast(PLAN, 'oud')).toBe('nieuw')
  const body = JSON.parse(verzoeken[0].init!.body as string)
  expect(body.sha).toBe('oud')
  expect(body.branch).toBe('main')
  expect(body.message).toBe('Weekmenu 2026-W48 vastgezet door Menno')
  expect(JSON.parse(vanBase64(body.content))).toEqual(PLAN)
})

test('zetVast zonder sha voor een nieuw plan', async () => {
  const { repo: r, verzoeken } = repo({ 'PUT contents/weekmenu/plannen/2026-W48.json': { status: 201, body: { content: { sha: 'n' } } } })
  await r.zetVast(PLAN, null)
  expect('sha' in JSON.parse(verzoeken[0].init!.body as string)).toBe(false)
})

test('zetVast: 409 en 422 worden VerouderdFout', async () => {
  for (const status of [409, 422]) {
    const { repo: r } = repo({ 'PUT contents/weekmenu/plannen/2026-W48.json': { status } })
    await expect(r.zetVast(PLAN, 'oud')).rejects.toBeInstanceOf(VerouderdFout)
  }
})

test('401 en 403 worden TokenFout', async () => {
  for (const status of [401, 403]) {
    await expect(repo({ 'GET git/trees/main?recursive=1': { status } }).repo.recepten()).rejects.toBeInstanceOf(TokenFout)
  }
})

test('andere fout geeft een leesbare melding', async () =>
  await expect(repo({ 'GET git/trees/main?recursive=1': { status: 500 } }).repo.recepten()).rejects.toThrow('GitHub gaf status 500'))
