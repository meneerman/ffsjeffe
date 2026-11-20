import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { behoeften, boodschappenRegels } from '../core/boodschappen'
import { recept, ing } from '../core/testdata'
import type { Recept, WeekPlan } from '../core/types'
import { VerouderdFout } from '../data/github'
import { NepRepo } from './nepRepo'
import type { AppData } from './useData'
import { Week } from './Week'

const ZATERDAG = new Date(2026, 10, 21) // plant week 48
beforeEach(() => localStorage.clear())
afterEach(cleanup)

async function toon(repo: NepRepo, extra: Recept[] = [], herlaad = vi.fn()) {
  repo.recepten_ = [...repo.recepten_, ...extra]
  const r = await repo.recepten()
  const data: AppData = { ...r, plannen: repo.plannen_, instellingen: { huishouden: 2 }, keepStatus: null }
  render(<Week data={data} repo={repo} naam="Menno" herlaad={herlaad} hash="#/" vandaag={ZATERDAG} />)
  return { data, herlaad }
}
const kaarten = () => screen.getAllByTestId('gerecht')
const titels = () => kaarten().map((k) => within(k).getByRole('link').textContent)
const extra = (n: number) => Array.from({ length: n }, (_, i) => recept(`extra${i}`, [ing('ui', 1, 'stuk')], { titel: `Extra ${i}` }))

test('toont de te plannen week met het voorstel', async () => {
  await toon(new NepRepo())
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Week 48 · 23–27 nov')
  expect(titels().sort()).toEqual(['Pasta met zalm en crème fraîche', 'Wraps met kip en crème fraîche'])
  expect(within(kaarten()[0]).getByText('ma')).toBeTruthy()
  expect(within(kaarten()[1]).getByText('di')).toBeTruthy()
})

test('meerdaags gerecht toont de vervolgdag', async () => {
  const repo = new NepRepo()
  repo.recepten_ = []
  await toon(repo, [recept('stoof', [], { titel: 'Stoofpot', dagen: 2 })])
  expect(screen.getByText('ma–di')).toBeTruthy()
  expect(screen.getByText('di: rest van Stoofpot')).toBeTruthy()
})

test('geen recepten geeft uitleg', async () => {
  const repo = new NepRepo()
  repo.recepten_ = []
  await toon(repo)
  expect(screen.getByText(/Nog geen recepten/)).toBeTruthy()
})

test('ruilen vervangt het gerecht en bewaart het concept', async () => {
  await toon(new NepRepo(), extra(4)) // 6 recepten, 5 dagen: precies één alternatief
  const voor = titels()
  await userEvent.click(within(kaarten()[0]).getByRole('button', { name: 'Ruil' }))
  const paneel = screen.getByRole('dialog')
  const keuze = within(paneel).getByRole('heading').textContent!
  expect(voor).not.toContain(keuze)
  await userEvent.click(within(paneel).getByRole('button', { name: 'Kies' }))
  expect(titels()[0]).toBe(keuze)
  expect(screen.queryByRole('dialog')).toBeNull()
  const concept = JSON.parse(localStorage.getItem('ffsjeffe.concept.2026-W48')!)
  expect(concept).toHaveLength(5)
})

test('ruilen: volgende en sluiten', async () => {
  await toon(new NepRepo(), extra(5)) // 7 recepten: twee alternatieven
  await userEvent.click(within(kaarten()[0]).getByRole('button', { name: 'Ruil' }))
  const eerste = within(screen.getByRole('dialog')).getByRole('heading').textContent
  await userEvent.click(screen.getByRole('button', { name: 'Volgende' }))
  expect(within(screen.getByRole('dialog')).getByRole('heading').textContent).not.toBe(eerste)
  await userEvent.click(screen.getByRole('button', { name: 'Sluiten' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('omlaag verplaatst een gerecht', async () => {
  await toon(new NepRepo())
  const [a, b] = titels()
  await userEvent.click(within(kaarten()[0]).getByRole('button', { name: 'Omlaag' }))
  expect(titels()).toEqual([b, a])
})

test('vastzetten stuurt het verwachte weekplan', async () => {
  const repo = new NepRepo()
  const { data } = await toon(repo)
  await userEvent.click(screen.getByRole('button', { name: 'Vastzetten' }))
  expect(await screen.findByText(/Vastgezet door Menno/)).toBeTruthy()
  const { plan, sha } = repo.vastgezet[0]
  const perId = Object.fromEntries(data.recepten.map((r) => [r.id, r]))
  expect(sha).toBeNull()
  expect(plan).toMatchObject({ week: '2026-W48', status: 'vastgezet', door: 'Menno' })
  expect(plan.slots.map((s) => perId[s.receptId].titel)).toEqual(titels())
  expect(plan.boodschappen).toEqual(boodschappenRegels(behoeften(plan.slots, perId, 2), data.verpakkingen))
  expect(Number.isNaN(Date.parse(plan.vastgezetOp))).toBe(false)
  expect(localStorage.getItem('ffsjeffe.concept.2026-W48')).toBeNull()
})

test('opnieuw vastzetten gebruikt de nieuwe sha', async () => {
  const repo = new NepRepo()
  await toon(repo)
  await userEvent.click(screen.getByRole('button', { name: 'Vastzetten' }))
  await screen.findByText(/Vastgezet door Menno/)
  await userEvent.click(within(kaarten()[0]).getByRole('button', { name: 'Omlaag' }))
  await userEvent.click(screen.getByRole('button', { name: 'Vastzetten' }))
  await vi.waitFor(() => expect(repo.vastgezet).toHaveLength(2))
  expect(repo.vastgezet[1].sha).toBe('sha1')
})

test('VerouderdFout toont de melding en een herlaadknop', async () => {
  const repo = new NepRepo()
  repo.zetVastFout = new VerouderdFout()
  const { herlaad } = await toon(repo)
  await userEvent.click(screen.getByRole('button', { name: 'Vastzetten' }))
  expect(await screen.findByText('Iemand anders heeft deze week net aangepast. Herlaad en probeer opnieuw.')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Herladen' }))
  expect(herlaad).toHaveBeenCalled()
})

test('een vastgezet plan wordt getoond in plaats van een nieuw voorstel', async () => {
  const repo = new NepRepo()
  const plan: WeekPlan = { week: '2026-W48', status: 'vastgezet', slots: [{ receptId: 'wraps-kip', dagen: 1 }], boodschappen: [], vastgezetOp: '2026-11-21T09:00:00+01:00', door: 'Partner' }
  repo.plannen_ = [{ plan, sha: 'abc' }]
  await toon(repo)
  expect(titels()).toEqual(['Wraps met kip en crème fraîche'])
  expect(screen.getByText(/Vastgezet door Partner/)).toBeTruthy()
})

test('volgende week wisselen', async () => {
  await toon(new NepRepo())
  await userEvent.click(screen.getByRole('button', { name: 'Volgende week' }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Week 49 · 30 nov – 4 dec')
  await userEvent.click(screen.getByRole('button', { name: 'Deze week' }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Week 48 · 23–27 nov')
})

test('opnieuw voorstellen wist het concept', async () => {
  await toon(new NepRepo())
  const voor = titels()
  await userEvent.click(within(kaarten()[0]).getByRole('button', { name: 'Omlaag' }))
  await userEvent.click(screen.getByRole('button', { name: 'Opnieuw voorstellen' }))
  expect(titels()).toEqual(voor)
  expect(localStorage.getItem('ffsjeffe.concept.2026-W48')).toBeNull()
})
