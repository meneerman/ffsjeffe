import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { gerecht, menuMet } from '../core/testdata'
import { BereidKnop } from './BereidKnop'
import { NepRepo, PASTA } from './nepRepo'
import type { AppData } from './useData'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

function opzet(metMenu = true) {
  const repo = new NepRepo()
  if (metMenu) repo.menu_ = { menu: menuMet([gerecht(PASTA)]), sha: 's' }
  const data = { menu: repo.menu_ } as AppData
  const bijgewerkt = vi.fn()
  render(<BereidKnop recept={repo.recepten_[0]} data={data} repo={repo} naam="M" bijgewerkt={bijgewerkt} />)
  return { repo, bijgewerkt }
}
const klik = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }))

test('sterren kiezen vinkt het gerecht op het menu af', async () => {
  const { repo, bijgewerkt } = opzet()
  await klik('Bereid en gegeten')
  await klik('4 sterren')
  await klik('Bevestigen')
  const m = repo.geschreven[0].menu
  expect(m.batches[0].gerechten[0].gegetenOp).toBeTruthy()
  expect(m.beoordelingen[PASTA]).toBe(4)
  expect(bijgewerkt).toHaveBeenCalledOnce()
  expect(await screen.findByRole('button', { name: /Vandaag gegeten/ })).toBeTruthy()
})

test('zonder menu worden alleen sterren en datum bewaard; annuleren schrijft niets', async () => {
  const { repo } = opzet(false)
  await klik('Bereid en gegeten')
  await klik('Annuleren')
  expect(repo.geschreven).toHaveLength(0)
  await klik('Bereid en gegeten')
  await klik('5 sterren')
  await klik('Bevestigen')
  expect(repo.geschreven[0].menu).toMatchObject({ batches: [], leegmakenOp: null, beoordelingen: { [PASTA]: 5 } })
})

test('een schrijffout is zichtbaar en de knop blijft bruikbaar', async () => {
  const { repo } = opzet()
  repo.zetFout = new Error('GitHub gaf status 500')
  await klik('Bereid en gegeten')
  await klik('Bevestigen')
  expect((await screen.findByRole('alert')).textContent).toContain('status 500')
  expect((screen.getByRole('button', { name: 'Bereid en gegeten' }) as HTMLButtonElement).disabled).toBe(false)
})
