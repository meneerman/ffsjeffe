import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { TokenFout } from '../data/github'
import App from './App'
import { NepRepo } from './nepRepo'

beforeEach(() => { localStorage.clear(); location.hash = '' })
afterEach(cleanup)

const verbind = () => localStorage.setItem('ffsjeffe.verbinding', JSON.stringify({ owner: 'meneerman', repo: 'ffsjeffe-data', token: 'tok', naam: 'Menno' }))

test('zonder verbinding toont de app de instellingen', () => {
  render(<App maakRepo={() => new NepRepo()} />)
  expect(screen.getByLabelText('Jouw naam')).toBeTruthy()
  expect(screen.getByLabelText('GitHub-token')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Opslaan' })).toBeTruthy()
})

test('na opslaan wordt de verbinding bewaard en geladen', async () => {
  const repo = new NepRepo()
  let gemaakt: unknown = null
  render(<App maakRepo={(v) => { gemaakt = v; return repo }} />)
  await userEvent.type(screen.getByLabelText('Jouw naam'), 'Menno')
  await userEvent.type(screen.getByLabelText('GitHub-token'), 'tok')
  await userEvent.click(screen.getByRole('button', { name: 'Opslaan' }))
  expect(await screen.findByTestId('geladen')).toBeTruthy()
  expect(gemaakt).toEqual({ owner: 'meneerman', repo: 'ffsjeffe-data', token: 'tok' })
  expect(JSON.parse(localStorage.getItem('ffsjeffe.verbinding')!)).toMatchObject({ naam: 'Menno', token: 'tok' })
})

test('opslaan zonder naam of token kan niet', async () => {
  render(<App maakRepo={() => new NepRepo()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Opslaan' }))
  expect(screen.getByText('Vul je naam en een token in.')).toBeTruthy()
})

test('TokenFout toont de melding en de instellingen', async () => {
  verbind()
  const repo = new NepRepo()
  repo.leesFout = new TokenFout()
  render(<App maakRepo={() => repo} />)
  expect(await screen.findByText('Het token werkt niet (meer). Vul een nieuw token in.')).toBeTruthy()
  expect(screen.getByLabelText('GitHub-token')).toBeTruthy()
})

test('andere laadfout toont melding en knop opnieuw', async () => {
  verbind()
  const repo = new NepRepo()
  repo.leesFout = new Error('GitHub gaf status 500')
  render(<App maakRepo={() => repo} />)
  expect(await screen.findByText(/GitHub gaf status 500/)).toBeTruthy()
  repo.leesFout = null
  await userEvent.click(screen.getByRole('button', { name: 'Opnieuw' }))
  expect(await screen.findByTestId('geladen')).toBeTruthy()
})

test('receptfouten worden getoond', async () => {
  verbind()
  const repo = new NepRepo()
  repo.fouten_ = [{ pad: 'recepten/kapot.md', fout: 'titel ontbreekt' }]
  render(<App maakRepo={() => repo} />)
  expect(await screen.findByText('Niet ingelezen: recepten/kapot.md (titel ontbreekt)')).toBeTruthy()
})

test('kapotte localStorage-waarde geeft gewoon de instellingen', () => {
  localStorage.setItem('ffsjeffe.verbinding', '{kapot')
  render(<App maakRepo={() => new NepRepo()} />)
  expect(screen.getByLabelText('Jouw naam')).toBeTruthy()
})

test('achtergrond heeft twee gloedvlakken en is aria-hidden', () => {
  const { container } = render(<App maakRepo={() => new NepRepo()} />)
  const a = container.querySelector('.achtergrond')!
  expect(a.getAttribute('aria-hidden')).toBe('true')
  expect(a.querySelectorAll('.gloed')).toHaveLength(2)
})

test('gegeten blijft staan na recept openen en terug, en vastzetten daarna geeft geen conflict', async () => {
  verbind()
  const repo = new NepRepo()
  const recept = repo.recepten_[0].id
  repo.menu_ = { menu: { versie: 2, ronde: 'R', gerechten: [{ receptId: recept, eters: 2, gegetenOp: null, vorigeKeer: null }], boodschappen: [], vastgezetOp: '2026-11-20T10:00:00.000Z', door: 'P', leegmakenOp: null, laatstGegeten: {} }, sha: 's0' }
  render(<App maakRepo={() => repo} />)
  await userEvent.click(await screen.findByRole('button', { name: `${recept} gegeten` }))
  await screen.findByText(/✓ gegeten/)
  location.hash = `#/recept/${encodeURIComponent(recept)}`
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  await screen.findByRole('heading', { level: 1, name: recept })
  location.hash = '#/'
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  expect(await screen.findByText(/✓ gegeten/)).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: /Op de boodschappenlijst/ }))
  await waitFor(() => expect(repo.geschreven).toHaveLength(2))
  expect(screen.queryByText(/Iemand anders/)).toBeNull()
})
