import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ing, recept } from '../core/testdata'
import { GEEN_WINKELS } from '../core/winkels'
import { NepRepo } from './nepRepo'
import { ReceptPagina } from './Recept'
import { piep } from './alarm'
import { TimerBalk } from './TimerBalk'
import { klok, vergeetTimers } from './timers'
import type { AppData } from './useData'

vi.mock('./alarm', () => ({ ontgrendel: vi.fn(), piep: vi.fn(), stil: vi.fn() }))

const R = recept('Spies', [ing('kip', 500, 'g')], { voorbereiding: ['Week de spiesen een half uur in water.'], stappen: ['Gril de spiesen 7 min.', 'Kook de rijst 10 min.'] })
const data = { recepten: [R], fouten: [], verpakkingen: {}, categorieen: {}, winkels: { nietBijLidl: [], nietBijAh: [] }, menu: null, instellingen: { huishouden: 4 }, keepStatus: null, concept: null } as unknown as AppData
const pagina = (hash = '#/recept/Spies') => <><ReceptPagina recept={R} data={{ ...data, winkels: GEEN_WINKELS }} repo={new NepRepo()} naam="M" /><TimerBalk hash={hash} /></>
const verder = (s: number) => act(() => { vi.advanceTimersByTime(s * 1000) })
const knop = (name: string | RegExp) => screen.getByRole('button', { name })

beforeEach(() => { localStorage.clear(); vergeetTimers(); vi.useFakeTimers(); vi.mocked(piep).mockClear() })
afterEach(() => { cleanup(); vi.useRealTimers() })

test('starten telt af zonder de stap af te vinken, en meerdere timers lopen tegelijk', () => {
  render(pagina())
  fireEvent.click(knop('Start timer 7 min bij stap 1'))
  fireEvent.click(knop('Start timer 10 min bij stap 2'))
  expect(screen.getAllByRole('timer').map((t) => t.textContent)).toEqual(['7:00', '10:00'])
  expect(knop(/^Stap 1: Gril/).getAttribute('aria-pressed')).toBe('false')
  verder(61)
  expect(screen.getAllByRole('timer').map((t) => t.textContent)).toEqual(['5:59', '8:59'])
  expect(screen.queryByRole('list', { name: 'Timers' })).toBeNull()
})

test('afgelopen: geluid blijft klinken tot Zet uit', () => {
  render(pagina())
  fireEvent.click(knop('Start timer 7 min bij stap 1'))
  verder(420)
  expect(screen.getAllByRole('alert')[0].textContent).toBe('Tijd is om!')
  const eerst = vi.mocked(piep).mock.calls.length
  expect(eerst).toBeGreaterThan(0)
  verder(6)
  expect(vi.mocked(piep).mock.calls.length).toBeGreaterThan(eerst)
  fireEvent.click(knop('Zet uit'))
  const na = vi.mocked(piep).mock.calls.length
  verder(6)
  expect(vi.mocked(piep).mock.calls.length).toBe(na)
  expect(screen.queryByRole('alert')).toBeNull()
})

test('+1 min en Stop', () => {
  render(pagina())
  fireEvent.click(knop('Start timer 30 min bij voorbereiding 1'))
  fireEvent.click(knop('+1 min'))
  expect(screen.getByRole('timer').textContent).toBe('31:00')
  fireEvent.click(knop('Stop'))
  expect(screen.queryByRole('timer')).toBeNull()
})

test('op een andere pagina staat de timer in de balk onderin en overleeft herladen', () => {
  const eerste = render(pagina())
  fireEvent.click(knop('Start timer 7 min bij stap 1'))
  eerste.unmount()
  vergeetTimers()
  render(<TimerBalk hash="#/" />)
  expect(screen.getByRole('list', { name: 'Timers' }).textContent).toContain('7:00Stap 1 · Spies')
})

test('een uren geleden afgelopen timer gaat niet meer af', () => {
  localStorage.setItem('ffsjeffe.timers', JSON.stringify([{ id: 'x', plek: 'x', receptId: 'Spies', naam: 'Stap 1', duur: 60, eind: Date.now() - 3 * 3600_000 }]))
  vergeetTimers()
  render(<TimerBalk hash="#/" />)
  expect(screen.queryByRole('list', { name: 'Timers' })).toBeNull()
})

test('klok', () => {
  expect([klok(272_000), klok(3_900_000), klok(400), klok(-5)]).toEqual(['4:32', '1:05:00', '0:01', '0:00'])
})
