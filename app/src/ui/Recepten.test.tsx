import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { gerecht, ing, recept } from '../core/testdata'
import type { Menu, Recept } from '../core/types'
import App from './App'
import { NepRepo, PASTA, WRAPS } from './nepRepo'
import { Recepten } from './Recepten'
import type { AppData } from './useData'

beforeEach(() => { localStorage.clear(); location.hash = '#/recepten' })
afterEach(() => { cleanup(); location.hash = '' })

const EXTRA: Recept[] = [
  recept('Tiramisu', [ing('mascarpone', 250, 'g')], { soort: 'toetje' }),
  recept('Pannenkoeken', [ing('bloem', 250, 'g')], { soort: 'ontbijt' }),
  recept('Bolognesesaus', [ing('gehakt', 750, 'g')], { porties: 12, avonden: 3, invriezen: true }),
]
const MENU: Menu = { versie: 2, ronde: 'R', gerechten: [gerecht(PASTA, 4)], boodschappen: [], vastgezetOp: '2026-11-20T10:00:00.000Z', door: 'P', leegmakenOp: null, laatstGegeten: {} }

async function toon(menu: Menu | null = MENU) {
  const repo = new NepRepo()
  repo.recepten_.push(...EXTRA)
  const data: AppData = { ...(await repo.recepten()), menu: menu ? { menu, sha: 's' } : null, instellingen: { huishouden: 4 }, keepStatus: null, concept: null }
  render(<Recepten data={data} repo={repo} naam="Menno" herlaad={() => {}} bijgewerkt={() => {}} hash="#/recepten" />)
}
const vinkje = (titel: string) => screen.getByRole('checkbox', { name: titel }) as HTMLInputElement

test('alle recepten gegroepeerd per soort, met filters en aantallen', async () => {
  await toon()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Alle recepten/)
  expect(screen.getByRole('heading', { level: 2, name: 'Avondeten' })).toBeTruthy()
  expect(screen.getByRole('heading', { level: 2, name: 'Toetje' })).toBeTruthy()
  expect(screen.getByRole('heading', { level: 2, name: 'Ontbijt' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Alles (5)' })).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Toetje (1)' }))
  expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  expect(vinkje('Tiramisu')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Alles (5)' }))
  expect(screen.getAllByRole('checkbox')).toHaveLength(5)
})

test('recept dat al op het menu staat is aangevinkt en vast', async () => {
  await toon()
  expect(vinkje(PASTA).checked).toBe(true)
  expect(vinkje(PASTA).disabled).toBe(true)
  expect(within(vinkje(PASTA).closest('li')!).getByText('op het menu')).toBeTruthy()
})

test('meerdere aanvinken en in één keer op het menu zetten', async () => {
  await toon()
  const knop = () => screen.getByRole('button', { name: /Op het menu/ }) as HTMLButtonElement
  expect(knop().disabled).toBe(true)
  await userEvent.click(vinkje('Tiramisu'))
  await userEvent.click(vinkje('Bolognesesaus'))
  expect(knop().textContent).toMatch(/Op het menu \(2\)/)
  await userEvent.click(knop())
  const c = JSON.parse(localStorage.getItem('ffsjeffe.concept')!)
  expect(c.gerechten.map((g: { receptId: string }) => g.receptId)).toEqual([PASTA, 'Bolognesesaus', 'Tiramisu'])
  expect(c.gerechten[1]).toMatchObject({ eters: 4, avonden: 3 })
  expect(c.gerechten[2]).toMatchObject({ eters: 4, avonden: 1 })
  expect(location.hash).toBe('#/')
})

test('weer uitvinken haalt uit de selectie', async () => {
  await toon(null)
  await userEvent.click(vinkje(WRAPS))
  await userEvent.click(vinkje(WRAPS))
  expect((screen.getByRole('button', { name: /Op het menu/ }) as HTMLButtonElement).disabled).toBe(true)
})

test('app: knop Alle recepten op het menu opent de lijst', async () => {
  location.hash = ''
  localStorage.setItem('ffsjeffe.verbinding', JSON.stringify({ owner: 'o', repo: 'r', token: 't', naam: 'Menno' }))
  render(<App maakRepo={() => new NepRepo()} />)
  await userEvent.click(await screen.findByRole('link', { name: /Alle recepten/ }))
  expect((await screen.findByRole('heading', { level: 1 })).textContent).toMatch(/Alle recepten/)
})

test('filter invriesbaar, te combineren met soort, en ❄ bij het recept', async () => {
  await toon()
  expect(within(vinkje('Bolognesesaus').closest('li')!).getByText(/❄/)).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: '❄ Invriesbaar (1)' }))
  expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['Bolognesesaus'])
  await userEvent.click(screen.getByRole('button', { name: 'Toetje (1)' }))
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  expect(screen.getByText('Geen recepten met deze filters.')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: '❄ Invriesbaar (1)' }))
  expect(screen.getAllByRole('checkbox')).toHaveLength(1)
})
