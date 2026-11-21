import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { gerecht, ing, recept } from '../core/testdata'
import type { Menu } from '../core/types'
import App from './App'
import { NepRepo, PASTA, WRAPS } from './nepRepo'
import { ReceptPagina } from './Recept'
import type { AppData } from './useData'

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const MENU: Menu = { versie: 2, ronde: 'R1', gerechten: [gerecht(PASTA, 3)], boodschappen: [], vastgezetOp: '2026-11-20T10:00:00.000Z', door: 'P', leegmakenOp: null, laatstGegeten: {} }

async function data(menu: Menu | null = MENU): Promise<AppData> {
  const repo = new NepRepo()
  return { ...(await repo.recepten()), menu: menu ? { menu, sha: 's' } : null, instellingen: { huishouden: 2 }, keepStatus: null }
}
const recept2 = (d: AppData, id = PASTA) => d.recepten.find((r) => r.id === id)!

test('kop, chips, benodigdheden, geschaalde ingrediënten, voorbereiding en bereiding', async () => {
  const d = await data()
  render(<ReceptPagina recept={recept2(d)} data={d} />)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(PASTA)
  expect(screen.getByText('25 min')).toBeTruthy()
  expect(screen.getByLabelText('eters').textContent).toBe('3')
  expect(within(screen.getByRole('list', { name: 'Benodigdheden' })).getByText('knoflookpers')).toBeTruthy()
  expect(screen.getByText('300 g pasta')).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Snijd 1,5 zalmfilets in blokjes van 2 cm.' })).toBeTruthy()
  expect(screen.getByText('Kook 300 g pasta beetgaar volgens de verpakking.')).toBeTruthy()
  expect(screen.getByText('Lekker met wat citroenrasp erover.')).toBeTruthy()
})

test('stappen afvinken: huidige stap uitgelicht, voortgang, onthouden', async () => {
  const d = await data()
  const { unmount } = render(<ReceptPagina recept={recept2(d)} data={d} />)
  expect(screen.getByText('Stap 1 van 6')).toBeTruthy()
  const stappen = () => screen.getAllByRole('button', { name: /^Stap \d+:/ })
  expect(stappen()[0].getAttribute('aria-current')).toBe('step')
  await userEvent.click(stappen()[0])
  expect(stappen()[0].getAttribute('aria-pressed')).toBe('true')
  expect(stappen()[1].getAttribute('aria-current')).toBe('step')
  expect(screen.getByText('Stap 2 van 6')).toBeTruthy()
  unmount()
  render(<ReceptPagina recept={recept2(d)} data={d} />)
  expect(screen.getByText('Stap 2 van 6')).toBeTruthy()
  for (const s of stappen().slice(1)) await userEvent.click(s)
  expect(screen.getByText('Klaar. Eet smakelijk!')).toBeTruthy()
})

test('− + past het menu-concept aan', async () => {
  const d = await data()
  render(<ReceptPagina recept={recept2(d)} data={d} />)
  await userEvent.click(screen.getByRole('button', { name: 'Meer eters' }))
  expect(screen.getByText('400 g pasta')).toBeTruthy()
  const c = JSON.parse(localStorage.getItem('ffsjeffe.concept')!)
  expect(c.gerechten[0]).toMatchObject({ receptId: PASTA, eters: 4 })
})

test('recept niet op het menu: standaard eters, concept blijft onaangeroerd', async () => {
  const d = await data()
  render(<ReceptPagina recept={recept2(d, WRAPS)} data={d} />)
  expect(screen.getByLabelText('eters').textContent).toBe('2')
  await userEvent.click(screen.getByRole('button', { name: 'Meer eters' }))
  expect(screen.getByLabelText('eters').textContent).toBe('3')
  expect(localStorage.getItem('ffsjeffe.concept')).toBeNull()
})

test('afvinken wordt doorgestreept en onthouden per ronde', async () => {
  const d = await data()
  const { unmount } = render(<ReceptPagina recept={recept2(d)} data={d} />)
  await userEvent.click(screen.getByRole('checkbox', { name: '300 g pasta' }))
  expect((screen.getByRole('checkbox', { name: '300 g pasta' }) as HTMLInputElement).checked).toBe(true)
  unmount()
  render(<ReceptPagina recept={recept2(d)} data={d} />)
  expect((screen.getByRole('checkbox', { name: '300 g pasta' }) as HTMLInputElement).checked).toBe(true)
  cleanup()
  const nieuweRonde = await data({ ...MENU, ronde: 'R2' })
  render(<ReceptPagina recept={recept2(nieuweRonde)} data={nieuweRonde} />)
  expect((screen.getByRole('checkbox', { name: '300 g pasta' }) as HTMLInputElement).checked).toBe(false)
})

test('bronlink alleen bij http(s)', async () => {
  const d = await data()
  render(<ReceptPagina recept={recept2(d)} data={d} />)
  expect(screen.getByRole('link', { name: /Origineel recept/ }).getAttribute('href')).toBe('https://example.com/pasta-zalm')
  cleanup()
  render(<ReceptPagina recept={recept2(d, WRAPS)} data={d} />)
  expect(screen.queryByRole('link', { name: /Origineel recept/ })).toBeNull()
})

test('scherm blijft aan: aangevraagd, label zichtbaar, opnieuw na terugkeren, vrijgegeven', async () => {
  const release = vi.fn().mockResolvedValue(undefined)
  const lock = { release, released: false, addEventListener: vi.fn() }
  const request = vi.fn().mockResolvedValue(lock)
  vi.stubGlobal('navigator', { ...navigator, wakeLock: { request } })
  const d = await data()
  const { unmount } = render(<ReceptPagina recept={recept2(d)} data={d} />)
  await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'))
  expect(await screen.findByText('scherm blijft aan')).toBeTruthy()
  lock.released = true // de browser geeft hem vrij als je de app even verlaat
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  unmount()
  await vi.waitFor(() => expect(release).toHaveBeenCalled())
})

test('zonder wake lock geen fout', async () => {
  vi.stubGlobal('navigator', { ...navigator, wakeLock: undefined })
  const d = await data()
  render(<ReceptPagina recept={recept2(d)} data={d} />)
  expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
})

test('app toont de kookpagina via #/recept/<titel> en onbekend recept netjes', async () => {
  localStorage.setItem('ffsjeffe.verbinding', JSON.stringify({ owner: 'o', repo: 'r', token: 't', naam: 'Menno' }))
  location.hash = `#/recept/${encodeURIComponent(PASTA)}`
  render(<App maakRepo={() => new NepRepo()} />)
  expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(PASTA)
  cleanup()
  location.hash = '#/recept/bestaat-niet'
  render(<App maakRepo={() => new NepRepo()} />)
  expect(await screen.findByText(/Recept niet gevonden/)).toBeTruthy()
  location.hash = ''
})

test('batchgerecht: porties, eters en avonden los te plussen, hoeveelheden kloppen', async () => {
  const repo = new NepRepo()
  repo.recepten_.push(recept('Bolognesesaus', [ing('half om half gehakt', 750, 'g')], { porties: 12, avonden: 3, stappen: ['Bak {750 g} gehakt 8 min.'] }))
  const d: AppData = { ...(await repo.recepten()), menu: { menu: { ...MENU, gerechten: [gerecht('Bolognesesaus', 4, { avonden: 3 })] }, sha: 's' }, instellingen: { huishouden: 4 }, keepStatus: null }
  render(<ReceptPagina recept={recept2(d, 'Bolognesesaus')} data={d} />)
  expect(screen.getByText('12 porties')).toBeTruthy()
  expect(screen.getByText('750 g half om half gehakt')).toBeTruthy()
  expect(screen.getByText('Bak 750 g gehakt 8 min.')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Minder avonden' }))
  expect(screen.getByText('8 porties')).toBeTruthy()
  expect(screen.getByText('500 g half om half gehakt')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Minder eters' }))
  expect(screen.getByText('6 porties')).toBeTruthy()
  expect(JSON.parse(localStorage.getItem('ffsjeffe.concept')!).gerechten[0]).toMatchObject({ eters: 3, avonden: 2 })
})

test('recept niet op het menu: begint op de standaard avonden van het recept', async () => {
  const repo = new NepRepo()
  repo.recepten_.push(recept('Soep', [ing('linzen', 400, 'g')], { porties: 8, avonden: 2 }))
  const d: AppData = { ...(await repo.recepten()), menu: null, instellingen: { huishouden: 4 }, keepStatus: null }
  render(<ReceptPagina recept={recept2(d, 'Soep')} data={d} />)
  expect(screen.getByText('8 porties')).toBeTruthy()
  expect(screen.getByLabelText('avonden').textContent).toBe('2')
  expect(localStorage.getItem('ffsjeffe.concept')).toBeNull()
})

test('gewoon gerecht (1 avond) toont geen porties-chip', async () => {
  const d = await data()
  render(<ReceptPagina recept={recept2(d)} data={d} />)
  expect(screen.queryByText(/^\d+ porties$/)).toBeNull()
})

test('terug naar het origineel zet eters × avonden op de porties van het recept', async () => {
  const repo = new NepRepo()
  repo.recepten_.push(recept('Bolognesesaus', [ing('half om half gehakt', 750, 'g')], { porties: 12, avonden: 3 }))
  const d: AppData = { ...(await repo.recepten()), menu: { menu: { ...MENU, gerechten: [gerecht('Bolognesesaus', 4, { avonden: 4 })] }, sha: 's' }, instellingen: { huishouden: 4 }, keepStatus: null }
  render(<ReceptPagina recept={recept2(d, 'Bolognesesaus')} data={d} />)
  expect(screen.getByText('1000 g half om half gehakt')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Origineel (12 porties)' }))
  expect(screen.getByText('750 g half om half gehakt')).toBeTruthy()
  expect(screen.getByLabelText('avonden').textContent).toBe('3')
  expect(screen.queryByRole('button', { name: /Origineel/ })).toBeNull()
})

test('origineel bij een gewoon recept van 2 porties: 2 eters, 1 avond', async () => {
  const d = await data()
  render(<ReceptPagina recept={recept2(d, WRAPS)} data={d} />)
  await userEvent.click(screen.getByRole('button', { name: 'Origineel (4 porties)' }))
  expect(screen.getByLabelText('eters').textContent).toBe('4')
  expect(screen.queryByRole('button', { name: /Origineel/ })).toBeNull()
})

test('invriesbaar recept toont een chip, ander niet', async () => {
  const repo = new NepRepo()
  repo.recepten_.push(recept('Soep', [ing('linzen', 400, 'g')], { invriezen: true }))
  const d: AppData = { ...(await repo.recepten()), menu: null, instellingen: { huishouden: 4 }, keepStatus: null }
  render(<ReceptPagina recept={recept2(d, 'Soep')} data={d} />)
  expect(screen.getByText('❄ Invriesbaar')).toBeTruthy()
  cleanup()
  render(<ReceptPagina recept={recept2(d, PASTA)} data={d} />)
  expect(screen.queryByText('❄ Invriesbaar')).toBeNull()
})
