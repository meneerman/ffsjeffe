import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { behoeften, boodschappenRegels } from '../core/boodschappen'
import App from './App'
import { Boodschappen } from './Boodschappen'
import { KeepStatusMelding } from './KeepStatus'
import { NepRepo, voorbeeldRecepten } from './nepRepo'
import { ReceptPagina } from './Recept'

beforeEach(() => { localStorage.clear(); location.hash = '' })
afterEach(() => { cleanup(); vi.useRealTimers() })

const [pasta, wraps] = voorbeeldRecepten()
const perId = { [pasta.id]: pasta, [wraps.id]: wraps }

test('receptpagina schaalt 4 naar 2 porties', () => {
  render(<ReceptPagina recept={pasta} huishouden={2} />)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(pasta.titel)
  expect(screen.getByText('Voor 2 personen · 25 min')).toBeTruthy()
  expect(screen.getByText('200 g pasta')).toBeTruthy()
  expect(screen.getByText('50 ml crème fraîche')).toBeTruthy()
  expect(screen.getByText('peper')).toBeTruthy()
  expect(screen.getByText(/Kook de pasta/)).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Origineel recept' }).getAttribute('href')).toBe('https://example.com/pasta-zalm')
})

test('boodschappenvoorbeeld komt overeen met boodschappenRegels', async () => {
  const slots = [{ receptId: pasta.id, dagen: 1 }, { receptId: wraps.id, dagen: 1 }]
  const vp = (await new NepRepo().recepten()).verpakkingen
  render(<Boodschappen slots={slots} perId={perId} huishouden={2} verpakkingen={vp} />)
  const verwacht = boodschappenRegels(behoeften(slots, perId, 2), vp)
  expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(verwacht)
  expect(verwacht).toContain('Crème fraîche 1× 200 ml')
})

test('status ok:false toont de mislukt-melding', () => {
  render(<KeepStatusMelding repo={new NepRepo()} vastgezetOp={null} begin={{ tijd: '2026-11-21T10:00:00Z', ok: false, melding: 'RuntimeError: login', weken: [] }} />)
  expect(screen.getByText('Keep bijwerken mislukt: RuntimeError: login')).toBeTruthy()
})

test('zonder vastzetting en met goede status: niets te melden', () => {
  const { container } = render(<KeepStatusMelding repo={new NepRepo()} vastgezetOp={null} begin={{ tijd: 'x', ok: true, melding: '', weken: [] }} />)
  expect(container.textContent).toBe('')
})

test('na vastzetten pollen tot de status nieuwer is', async () => {
  vi.useFakeTimers()
  const repo = new NepRepo()
  repo.status_ = { tijd: '2026-11-21T09:00:00Z', ok: true, melding: '', weken: [] }
  render(<KeepStatusMelding repo={repo} vastgezetOp="2026-11-21T10:00:00Z" begin={repo.status_} />)
  expect(screen.getByText('Keep bijwerken…')).toBeTruthy()
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(screen.getByText('Keep bijwerken…')).toBeTruthy()
  repo.status_ = { tijd: '2026-11-21T10:00:40Z', ok: true, melding: '', weken: ['2026-W48'] }
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(screen.getByText('Staat in Keep ✓')).toBeTruthy()
})

test('na 3 minuten zonder nieuwe status: geduldmelding', async () => {
  vi.useFakeTimers()
  const repo = new NepRepo()
  render(<KeepStatusMelding repo={repo} vastgezetOp="2026-11-21T10:00:00Z" begin={null} />)
  await act(() => vi.advanceTimersByTimeAsync(190_000))
  expect(screen.getByText('Keep reageert nog niet. Kijk straks nog eens.')).toBeTruthy()
})

test('app toont de receptpagina via #/recept/<id>', async () => {
  localStorage.setItem('ffsjeffe.verbinding', JSON.stringify({ owner: 'o', repo: 'r', token: 't', naam: 'Menno' }))
  location.hash = '#/recept/pasta-zalm'
  render(<App maakRepo={() => new NepRepo()} />)
  expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(pasta.titel)
})

test('onbekend recept', async () => {
  localStorage.setItem('ffsjeffe.verbinding', JSON.stringify({ owner: 'o', repo: 'r', token: 't', naam: 'Menno' }))
  location.hash = '#/recept/bestaat-niet'
  render(<App maakRepo={() => new NepRepo()} />)
  expect(await screen.findByText('Recept niet gevonden.')).toBeTruthy()
})
