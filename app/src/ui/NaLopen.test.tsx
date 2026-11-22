import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

// jsdom heeft geen layout: een sleep naar y=… wijst de rij met dat nummer aan
function wijsRijAan(rijen: HTMLElement[]) {
  document.elementFromPoint = ((_x: number, y: number) => rijen[Math.min(rijen.length - 1, Math.floor(y / 50))]?.querySelector('input') ?? null) as typeof document.elementFromPoint
}

test('slepen over de vinkjes zet hele rijen in één keer uit (of aan)', () => {
  const onWissel = vi.fn()
  render(<NaLopen items={items} categorieen={categorieen} uit={new Set()} onWissel={onWissel} />)
  const vakken = screen.getAllByRole('checkbox')
  const rijen = vakken.map((v) => v.closest('li')!) as HTMLElement[]
  wijsRijAan(rijen)
  fireEvent.pointerDown(vakken[0], { clientX: 10, clientY: 10, pointerId: 1, button: 0 })
  fireEvent.pointerMove(vakken[0], { clientX: 10, clientY: 120, pointerId: 1 })
  fireEvent.pointerUp(vakken[0], { clientX: 10, clientY: 120, pointerId: 1 })
  expect(onWissel.mock.calls.map((c) => c[0]).sort()).toEqual([rijen[0], rijen[1], rijen[2]].map((r) => r.getAttribute('data-vink-id')).sort())
  // de klik die na het slepen volgt, mag de eerste rij niet nog eens omzetten
  fireEvent.click(vakken[0])
  expect(onWissel).toHaveBeenCalledTimes(3)
})

test('slepen naar rijen die al uit staan zet ze juist aan; een gewone tik werkt nog', async () => {
  const onWissel = vi.fn()
  render(<NaLopen items={items} categorieen={categorieen} uit={new Set(['Pasta 400 g', 'Olijfolie 30 ml'])} onWissel={onWissel} />)
  const vakken = screen.getAllByRole('checkbox')
  const rijen = vakken.map((v) => v.closest('li')!) as HTMLElement[]
  wijsRijAan(rijen)
  const eerstUit = vakken.findIndex((v) => !(v as HTMLInputElement).checked)
  fireEvent.pointerDown(vakken[eerstUit], { clientX: 10, clientY: eerstUit * 50 + 5, pointerId: 1, button: 0 })
  fireEvent.pointerMove(vakken[eerstUit], { clientX: 10, clientY: 3 * 50 + 5, pointerId: 1 })
  fireEvent.pointerUp(vakken[eerstUit], { pointerId: 1 })
  // alleen wat uit stond wordt aangezet; de rij eronder die al aan stond blijft zoals ze was
  expect(onWissel.mock.calls.map((c) => c[0]).sort()).toEqual(['Olijfolie 30 ml', 'Pasta 400 g'])
  onWissel.mockClear()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Ui 2' }))
  expect(onWissel).toHaveBeenCalledWith('Ui 2')
})

test('winkeliconen bij een boodschappenregel die niet bij Lidl of AH te koop is', () => {
  const winkels = { nietLidl: new Set(['pasta', 'ui']), nietAh: new Set(['ui']) }
  render(<NaLopen items={items} categorieen={categorieen} winkels={winkels} uit={new Set()} onWissel={() => {}} />)
  const rij = (n: string) => screen.getByRole('checkbox', { name: new RegExp(`^${n}`) }).closest('li')!
  expect(within(rij('Pasta 400 g')).getByLabelText('Niet bij Lidl')).toBeTruthy()
  expect(within(rij('Pasta 400 g')).queryByLabelText('Niet bij Albert Heijn')).toBeNull()
  expect(within(rij('Ui 2')).getByLabelText('Niet bij Albert Heijn')).toBeTruthy()
  expect(within(rij('Olijfolie 30 ml')).queryByLabelText(/Niet bij/)).toBeNull()
})
