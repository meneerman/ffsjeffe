import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { gerecht } from '../core/testdata'
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
const recept = (d: AppData, id = PASTA) => d.recepten.find((r) => r.id === id)!

test('kop, chips, geschaalde ingrediënten en bereiding met eters van het menu', async () => {
  const d = await data()
  render(<ReceptPagina recept={recept(d)} data={d} />)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(PASTA)
  expect(screen.getByText('25 min')).toBeTruthy()
  expect(screen.getByLabelText('eters').textContent).toBe('3')
  expect(screen.getByText('300 g pasta')).toBeTruthy()
  expect(screen.getByText('peper')).toBeTruthy()
  expect(screen.getByText('Kook 300 g pasta in ruim gezouten water beetgaar.')).toBeTruthy()
  expect(screen.getByText('Lekker met wat citroenrasp erover.')).toBeTruthy()
})

test('− + past het menu-concept aan', async () => {
  const d = await data()
  render(<ReceptPagina recept={recept(d)} data={d} />)
  await userEvent.click(screen.getByRole('button', { name: 'Meer eters' }))
  expect(screen.getByText('400 g pasta')).toBeTruthy()
  const c = JSON.parse(localStorage.getItem('ffsjeffe.concept')!)
  expect(c.gerechten[0]).toMatchObject({ receptId: PASTA, eters: 4 })
})

test('recept niet op het menu: standaard eters, concept blijft onaangeroerd', async () => {
  const d = await data()
  render(<ReceptPagina recept={recept(d, WRAPS)} data={d} />)
  expect(screen.getByLabelText('eters').textContent).toBe('2')
  await userEvent.click(screen.getByRole('button', { name: 'Meer eters' }))
  expect(screen.getByLabelText('eters').textContent).toBe('3')
  expect(localStorage.getItem('ffsjeffe.concept')).toBeNull()
})

test('afvinken wordt doorgestreept en onthouden per ronde', async () => {
  const d = await data()
  const { unmount } = render(<ReceptPagina recept={recept(d)} data={d} />)
  await userEvent.click(screen.getByRole('checkbox', { name: '300 g pasta' }))
  expect((screen.getByRole('checkbox', { name: '300 g pasta' }) as HTMLInputElement).checked).toBe(true)
  unmount()
  render(<ReceptPagina recept={recept(d)} data={d} />)
  expect((screen.getByRole('checkbox', { name: '300 g pasta' }) as HTMLInputElement).checked).toBe(true)
  cleanup()
  const nieuweRonde = await data({ ...MENU, ronde: 'R2' })
  render(<ReceptPagina recept={recept(nieuweRonde)} data={nieuweRonde} />)
  expect((screen.getByRole('checkbox', { name: '300 g pasta' }) as HTMLInputElement).checked).toBe(false)
})

test('bronlink alleen bij http(s)', async () => {
  const d = await data()
  render(<ReceptPagina recept={recept(d)} data={d} />)
  expect(screen.getByRole('link', { name: /Origineel recept/ }).getAttribute('href')).toBe('https://example.com/pasta-zalm')
  cleanup()
  render(<ReceptPagina recept={recept(d, WRAPS)} data={d} />)
  expect(screen.queryByRole('link', { name: /Origineel recept/ })).toBeNull()
})

test('scherm blijft aan: wake lock aangevraagd en vrijgegeven', async () => {
  const release = vi.fn().mockResolvedValue(undefined)
  const request = vi.fn().mockResolvedValue({ release })
  vi.stubGlobal('navigator', { ...navigator, wakeLock: { request } })
  const d = await data()
  const { unmount } = render(<ReceptPagina recept={recept(d)} data={d} />)
  await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'))
  unmount()
  await vi.waitFor(() => expect(release).toHaveBeenCalled())
})

test('zonder wake lock geen fout', async () => {
  vi.stubGlobal('navigator', { ...navigator, wakeLock: undefined })
  const d = await data()
  render(<ReceptPagina recept={recept(d)} data={d} />)
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
