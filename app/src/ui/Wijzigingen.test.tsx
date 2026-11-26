import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { NepRepo } from './nepRepo'
import { Wijzigingen } from './Wijzigingen'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const w = (id: string, receptId: string, tekst: string, verwerktOp: string | null = null) => ({ id, receptId, tekst, door: 'P', op: '2026-11-20T10:00:00.000Z', verwerktOp })
const veld = () => screen.getByRole('textbox', { name: 'Wat moet anders?' }) as HTMLTextAreaElement
const bewaar = () => userEvent.click(screen.getByRole('button', { name: 'Bewaar notitie' }))

test('toont alleen open notities van dit recept en voegt toe zonder andere te verliezen', async () => {
  const repo = new NepRepo()
  repo.wijzigingen_ = { wijzigingen: [w('1', 'A', 'minder zout'), w('2', 'B', 'ander recept'), w('3', 'A', 'al gedaan', '2026-11-21')], sha: 's' }
  render(<Wijzigingen receptId="A" repo={repo} naam="Menno" />)
  expect(await screen.findByText('minder zout')).toBeTruthy()
  expect(screen.queryByText('ander recept')).toBeNull()
  expect(screen.queryByText('al gedaan')).toBeNull()
  await userEvent.type(veld(), '  meer kip ')
  await bewaar()
  expect(await screen.findByText('meer kip')).toBeTruthy()
  expect(repo.wijzigingen_!.wijzigingen.map((x) => x.tekst)).toEqual(['minder zout', 'ander recept', 'al gedaan', 'meer kip'])
  expect(repo.wijzigingen_!.wijzigingen[3]).toMatchObject({ receptId: 'A', door: 'Menno', verwerktOp: null })
  expect(veld().value).toBe('')
})

test('verwijderen haalt alleen die notitie weg', async () => {
  const repo = new NepRepo()
  repo.wijzigingen_ = { wijzigingen: [w('1', 'A', 'weg'), w('2', 'B', 'blijft')], sha: 's' }
  render(<Wijzigingen receptId="A" repo={repo} naam="M" />)
  await userEvent.click(await screen.findByRole('button', { name: 'Verwijder notitie: weg' }))
  expect(repo.wijzigingen_!.wijzigingen.map((x) => x.id)).toEqual(['2'])
})

test('mislukt bewaren: melding, en de tekst blijft staan, ook na opnieuw openen', async () => {
  const repo = new NepRepo()
  repo.zetFout = new Error('geen internet')
  const eerste = render(<Wijzigingen receptId="A" repo={repo} naam="M" />)
  await userEvent.type(veld(), 'meer kip')
  await bewaar()
  expect((await screen.findByRole('alert')).textContent).toContain('geen internet')
  expect(veld().value).toBe('meer kip')
  eerste.unmount()
  render(<Wijzigingen receptId="A" repo={repo} naam="M" />)
  expect(veld().value).toBe('meer kip')
})
