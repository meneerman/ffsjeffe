import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { NaLopen } from './NaLopen'

afterEach(cleanup)

const items = [
  { naam: 'pasta', regel: 'Pasta 400 g' },
  { naam: 'olijfolie', regel: 'Olijfolie 30 ml' },
  { naam: 'ui', regel: 'Ui 2' },
  { naam: 'mysterie', regel: 'Mysterie 1' },
]
const categorieen = { pasta: 'Droog', olijfolie: 'Olie, sauzen & azijn', ui: 'Groente & fruit' } as const

test('items staan onder hun categorie in winkelvolgorde, alles aangevinkt', () => {
  render(<NaLopen items={items} categorieen={categorieen} uit={new Set()} onWissel={() => {}} />)
  expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Groente & fruit', 'Droog', 'Olie, sauzen & azijn', 'Overig'])
  const droog = screen.getByRole('heading', { name: 'Droog' }).closest('.nalopen-groep') as HTMLElement
  expect((within(droog).getByRole('checkbox', { name: 'Pasta 400 g' }) as HTMLInputElement).checked).toBe(true)
  expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('4 van 4')
})

test('een uitgevinkte regel is niet aangevinkt en telt niet mee; klikken geeft de regel door', async () => {
  const onWissel = vi.fn()
  render(<NaLopen items={items} categorieen={categorieen} uit={new Set(['Olijfolie 30 ml'])} onWissel={onWissel} />)
  expect((screen.getByRole('checkbox', { name: 'Olijfolie 30 ml' }) as HTMLInputElement).checked).toBe(false)
  expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('3 van 4')
  await userEvent.click(screen.getByRole('checkbox', { name: 'Ui 2' }))
  expect(onWissel).toHaveBeenCalledWith('Ui 2')
})

test('zonder regels niets tonen', () => {
  const { container } = render(<NaLopen items={[]} categorieen={{}} uit={new Set()} onWissel={() => {}} />)
  expect(container.innerHTML).toBe('')
})
