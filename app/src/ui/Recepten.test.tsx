import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { gerecht, ing, recept } from '../core/testdata'
import type { Menu, Recept } from '../core/types'
import App from './App'
import { NepRepo, PASTA, WRAPS } from './nepRepo'
import { Recepten } from './Recepten'
import type { AppData } from './useData'

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); location.hash = '#/recepten' })
afterEach(() => { cleanup(); location.hash = '' })

const EXTRA: Recept[] = [
  recept('Tiramisu', [ing('mascarpone', 250, 'g')], { soort: 'toetje' }),
  recept('Pannenkoeken', [ing('bloem', 250, 'g')], { soort: 'ontbijt' }),
  recept('Bolognesesaus', [ing('gehakt', 750, 'g')], { porties: 12, avonden: 3, invriezen: true }),
  recept('Broccolisoep', [ing('broccoli', 400, 'g'), ing('crème fraîche', 100, 'ml')], { soort: 'voorgerecht' }),
  recept('Kip uit de oven', [ing('kipfilet', 400, 'g'), ing('Broccoliroosjes', 300, 'g')]),
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
  expect(screen.getByRole('button', { name: 'Alles (7)' })).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Toetje (1)' }))
  expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  expect(vinkje('Tiramisu')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Alles (7)' }))
  expect(screen.getAllByRole('checkbox')).toHaveLength(7)
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
  expect(c.gerechten.map((g: { receptId: string }) => g.receptId)).toEqual(['Bolognesesaus', 'Tiramisu'])
  expect(c.gerechten[0]).toMatchObject({ eters: 4, avonden: 3 })
  expect(c.gerechten[1]).toMatchObject({ eters: 4, avonden: 1 })
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

const zoek = () => screen.getByRole('searchbox', { name: 'Zoek op ingrediënt' }) as HTMLInputElement
const typ = (t: string) => fireEvent.change(zoek(), { target: { value: t } })
const titelsNu = () => screen.queryAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))

test('zoeken op ingrediënt laat alleen recepten met dat ingrediënt staan', async () => {
  await toon()
  typ('broccoli')
  expect(titelsNu().sort()).toEqual(['Broccolisoep', 'Kip uit de oven'])
  expect(screen.getByText('2 van 7 recepten met broccoli')).toBeTruthy()
})

test('bij elk resultaat staat welk ingrediënt gevonden is', async () => {
  await toon()
  typ('broccoli')
  expect(within(vinkje('Kip uit de oven').closest('li')!).getByText('met Broccoliroosjes')).toBeTruthy()
  expect(within(vinkje('Broccolisoep').closest('li')!).getByText('met broccoli')).toBeTruthy()
})

test('accenten en hoofdletters maken niet uit; meerdere ingrediënten moeten allemaal kloppen', async () => {
  await toon()
  typ('CREME')
  expect(titelsNu().sort()).toEqual(['Broccolisoep', PASTA, WRAPS].sort())
  typ('creme, broccoli')
  expect(titelsNu()).toEqual(['Broccolisoep'])
})

test('filterchips tellen mee met de zoekopdracht', async () => {
  await toon()
  typ('broccoli')
  expect(screen.getByRole('button', { name: 'Alles (2)' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Voorgerecht (1)' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^Toetje/ })).toBeNull()
})

test('niets gevonden: duidelijke melding en Wissen brengt alles terug', async () => {
  await toon()
  typ('kreeft')
  expect(titelsNu()).toEqual([])
  expect(screen.getByText(/Geen recepten met/)).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Zoekopdracht wissen' }))
  expect(zoek().value).toBe('')
  expect(titelsNu()).toHaveLength(7)
})

test('aangevinkte recepten blijven geselecteerd als je een andere zoekopdracht doet', async () => {
  await toon()
  typ('mascarpone')
  await userEvent.click(vinkje('Tiramisu'))
  typ('gehakt')
  await userEvent.click(vinkje('Bolognesesaus'))
  expect(screen.getByRole('button', { name: /Op het menu \(2\)/ })).toBeTruthy()
})

test('de zoekopdracht blijft staan als je een recept opent en terugkomt', async () => {
  await toon()
  typ('broccoli')
  cleanup()
  await toon()
  expect(zoek().value).toBe('broccoli')
  expect(titelsNu()).toHaveLength(2)
})

test('slepen over de vinkjes in Alle recepten kiest meerdere recepten tegelijk', async () => {
  await toon(null)
  const vakken = screen.getAllByRole('checkbox') as HTMLInputElement[]
  const rijen = vakken.map((v) => v.closest('li')!) as HTMLElement[]
  document.elementFromPoint = ((_x: number, y: number) => rijen[Math.min(rijen.length - 1, Math.floor(y / 50))].querySelector('input')) as typeof document.elementFromPoint
  fireEvent.pointerDown(vakken[0], { clientX: 10, clientY: 5, pointerId: 1, button: 0 })
  fireEvent.pointerMove(vakken[0], { clientX: 10, clientY: 2 * 50 + 5, pointerId: 1 })
  fireEvent.pointerUp(vakken[0], { pointerId: 1 })
  await screen.findByRole('button', { name: /Op het menu \(3\)/ })
})

test('winkeliconen bij een recept in Alle recepten als er ingrediënten niet bij Lidl of AH te koop zijn', async () => {
  await toon(null)
  const rij = (t: string) => vinkje(t).closest('li')!
  // PASTA heeft zalmfilet (niet bij Lidl) en spinazie (niet bij AH)
  expect(within(rij(PASTA)).getByLabelText('Niet bij Lidl: zalmfilet, spinazie')).toBeTruthy()
  expect(within(rij(PASTA)).getByLabelText('Niet bij Albert Heijn: spinazie')).toBeTruthy()
  expect(within(rij(WRAPS)).queryByLabelText(/Niet bij/)).toBeNull()
})

test('gerechten kiezen en op het menu zetten brengt je terug in Plannen, ook als je eerder Bereiden had', async () => {
  sessionStorage.setItem('ffsjeffe.modus', 'bereiden')
  await toon(null)
  await userEvent.click(vinkje('Tiramisu'))
  await userEvent.click(screen.getByRole('button', { name: /Op het menu/ }))
  expect(sessionStorage.getItem('ffsjeffe.modus')).toBe('plannen')
})
