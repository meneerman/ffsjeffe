import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { behoeften, boodschappenRegels } from '../core/boodschappen'
import { gerecht, ing, recept } from '../core/testdata'
import type { Menu as MenuT, Recept } from '../core/types'
import { VerouderdFout } from '../data/github'
import { Menu } from './Menu'
import { NepRepo, PASTA, WRAPS } from './nepRepo'
import type { AppData } from './useData'

// jsdom heeft geen PointerEvent met coördinaten
if (!('PointerEvent' in window)) {
  ;(window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = class extends MouseEvent {} as typeof MouseEvent
}

const NU = new Date('2026-11-21T12:00:00Z')
beforeEach(() => localStorage.clear())
afterEach(cleanup)

const extra = (n: number) => Array.from({ length: n }, (_, i) => recept(`Extra ${i}`, [ing('ui', 1, 'stuk')]))
const menu = (gerechten = [gerecht(PASTA, 2)], extraVelden: Partial<MenuT> = {}): MenuT => ({
  versie: 2, ronde: '2026-11-20T10:00:00.000Z', gerechten, boodschappen: [], vastgezetOp: '2026-11-20T10:00:00.000Z',
  door: 'Partner', leegmakenOp: null, laatstGegeten: {}, ...extraVelden,
})

async function toon(repo: NepRepo, recepten: Recept[] = [], herlaad = vi.fn()) {
  repo.recepten_ = [...repo.recepten_, ...recepten]
  const r = await repo.recepten()
  const data: AppData = { ...r, menu: repo.menu_, instellingen: { huishouden: 2 }, keepStatus: null }
  function Houder() {
    const [d, setD] = useState(data)
    return <Menu data={d} repo={repo} naam="Menno" herlaad={herlaad} bijgewerkt={(menu) => setD((x) => ({ ...x, menu }))} hash="#/" nu={() => NU} />
  }
  render(<Houder />)
  return { data, herlaad }
}
async function verwijderBevestigd(titel: string) {
  await userEvent.click(screen.getByRole('button', { name: `Verwijder ${titel}` }))
  await userEvent.click(within(screen.getByRole('group', { name: `${titel} verwijderen?` })).getByRole('button', { name: 'Verwijder' }))
}
const kaarten = () => screen.queryAllByTestId('gerecht')
const titels = () => kaarten().map((k) => within(k).getByRole('link').textContent)

test('leeg menu: kop en een voorstel van 3', async () => {
  await toon(new NepRepo(), extra(3))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Wat eten we deze keer?')
  expect(kaarten()).toHaveLength(3)
  expect(within(kaarten()[0]).getByText(/nog nooit/)).toBeTruthy()
})

test('x dagen geleden', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA)], { laatstGegeten: { [PASTA]: '2026-11-03' } }), sha: 's' }
  await toon(repo)
  expect(screen.getByText(/18 dagen geleden/)).toBeTruthy()
})

test('＋ Gerecht erbij: Tinder-stapel met nee, erbij en geen maximum', async () => {
  await toon(new NepRepo(), extra(6))
  await userEvent.click(screen.getByRole('button', { name: /Gerecht erbij/ }))
  const dlg = () => screen.getByRole('dialog')
  const boven = () => within(dlg()).getByTestId('bovenste').querySelector('h2')!.textContent
  const eerste = boven()
  expect(within(dlg()).getAllByTestId('deck-kaart').length).toBeGreaterThanOrEqual(2) // volgende ligt eronder
  await userEvent.click(within(dlg()).getByRole('button', { name: 'Nee' }))
  await waitFor(() => expect(boven()).not.toBe(eerste))
  await userEvent.click(within(dlg()).getByRole('button', { name: 'Erbij' }))
  await waitFor(() => expect(kaarten()).toHaveLength(4))
  for (let i = 0; i < 2; i++) {
    await userEvent.click(screen.getByRole('button', { name: /Gerecht erbij/ }))
    await userEvent.click(within(dlg()).getByRole('button', { name: 'Erbij' }))
    await waitFor(() => expect(kaarten()).toHaveLength(5 + i))
  }
})

test('stapel: naar rechts slepen voorbij de drempel = erbij, kort slepen veert terug', async () => {
  await toon(new NepRepo(), extra(4))
  await userEvent.click(screen.getByRole('button', { name: /Gerecht erbij/ }))
  const kaart = within(screen.getByRole('dialog')).getByTestId('bovenste')
  fireEvent.pointerDown(kaart, { clientX: 100, clientY: 100 })
  fireEvent.pointerMove(kaart, { clientX: 140, clientY: 100 })
  fireEvent.pointerUp(kaart, { clientX: 140, clientY: 100 })
  expect(kaarten()).toHaveLength(3)
  fireEvent.pointerDown(kaart, { clientX: 100, clientY: 100 })
  fireEvent.pointerMove(kaart, { clientX: 300, clientY: 100 })
  expect(within(kaart).getByText('ERBIJ')).toBeTruthy()
  fireEvent.pointerUp(kaart, { clientX: 300, clientY: 100 })
  await waitFor(() => expect(kaarten()).toHaveLength(4))
})

test('verwijderen vraagt eerst om bevestiging', async () => {
  await toon(new NepRepo(), extra(3))
  const voor = titels()
  await userEvent.click(screen.getByRole('button', { name: `Verwijder ${voor[1]}` }))
  const vraag = screen.getByRole('group', { name: `${voor[1]} verwijderen?` })
  await userEvent.click(within(vraag).getByRole('button', { name: 'Annuleren' }))
  expect(titels()).toEqual(voor)
  await userEvent.click(screen.getByRole('button', { name: `Verwijder ${voor[1]}` }))
  await userEvent.click(within(screen.getByRole('group', { name: `${voor[1]} verwijderen?` })).getByRole('button', { name: 'Verwijder' }))
  await waitFor(() => expect(titels()).toEqual([voor[0], voor[2]]))
})

test('geen veeglaag meer onder de kaarten', async () => {
  await toon(new NepRepo(), extra(3))
  expect(document.querySelector('.veeg-achter')).toBeNull()
})

test('eters − + passen eters en boodschappen aan, minimaal 1', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA, 2)]), sha: 's' }
  await toon(repo)
  await userEvent.click(screen.getByRole('button', { name: /Boodschappen/ }))
  expect(screen.getByText('Pasta 200 g')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Meer eters' }))
  expect(screen.getByLabelText('eters').textContent).toBe('3')
  expect(screen.getByText('Pasta 300 g')).toBeTruthy()
  for (let i = 0; i < 4; i++) await userEvent.click(screen.getByRole('button', { name: 'Minder eters' }))
  expect(screen.getByLabelText('eters').textContent).toBe('1')
})

test('vastzetten schrijft het menu', async () => {
  const repo = new NepRepo()
  const { data, herlaad } = await toon(repo, extra(3))
  const getoond = titels()
  await userEvent.click(screen.getByRole('button', { name: /Op de boodschappenlijst/ }))
  await screen.findByText(/Vastgezet door Menno/)
  const { menu: m, sha, bericht } = repo.geschreven[0]
  expect(sha).toBeNull()
  expect(bericht).toBe('Menu vastgezet door Menno')
  expect(m).toMatchObject({ versie: 2, door: 'Menno', ronde: NU.toISOString(), vastgezetOp: NU.toISOString() })
  expect(m.gerechten.map((g) => g.receptId)).toEqual(getoond)
  const perId = Object.fromEntries(data.recepten.map((r) => [r.id, r]))
  expect(m.boodschappen).toEqual(boodschappenRegels(behoeften(m.gerechten, perId), data.verpakkingen))
  expect(localStorage.getItem('ffsjeffe.concept')).toBeNull()
  expect(herlaad).toHaveBeenCalled()
})

test('Keep leegmaken: bevestigen, annuleren, leegmaken', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA)]), sha: 's' }
  await toon(repo, extra(3))
  await userEvent.click(screen.getByRole('button', { name: 'Keep leegmaken' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuleren' }))
  expect(repo.geschreven).toHaveLength(0)
  await userEvent.click(screen.getByRole('button', { name: 'Keep leegmaken' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Leegmaken' }))
  await waitFor(() => expect(repo.geschreven).toHaveLength(1))
  expect(repo.geschreven[0]).toMatchObject({ sha: 's', bericht: 'Keep leeggemaakt door Menno' })
  expect(repo.geschreven[0].menu).toMatchObject({ gerechten: [], leegmakenOp: NU.toISOString() })
  await waitFor(() => expect(kaarten()).toHaveLength(3))
})

test('gegeten-vinkje alleen op vastgezette gerechten, heen en terug', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA)], { laatstGegeten: { [PASTA]: '2026-10-01' } }), sha: 's' }
  await toon(repo)
  await userEvent.click(screen.getByRole('button', { name: /Gerecht erbij/ }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Erbij' }))
  await waitFor(() => expect(kaarten()).toHaveLength(2))
  expect(screen.getAllByRole('button', { name: / gegeten$/ })).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: `${PASTA} gegeten` }))
  await screen.findByText('✓ gegeten vandaag')
  const w = repo.geschreven[0]
  expect(w.bericht).toBe(`${PASTA} gegeten — Menno`)
  expect(w.menu.laatstGegeten[PASTA]).toBe('2026-11-21')
  expect(w.menu.gerechten[0]).toMatchObject({ gegetenOp: '2026-11-21', vorigeKeer: '2026-10-01' })
  expect(w.menu.boodschappen).toEqual(repo.geschreven[0].menu.boodschappen)
  expect(titels().at(-1)).toBe(PASTA) // gegeten staat onderaan
  await userEvent.click(screen.getByRole('button', { name: `${PASTA} gegeten` }))
  await waitFor(() => expect(repo.geschreven).toHaveLength(2))
  expect(repo.geschreven[1].menu.laatstGegeten[PASTA]).toBe('2026-10-01')
})

test('alles wegvegen: leeg menu met Nieuw voorstel', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA)]), sha: 's' }
  await toon(repo, extra(3))
  await verwijderBevestigd(PASTA)
  await waitFor(() => expect(kaarten()).toHaveLength(0))
  await userEvent.click(screen.getByRole('button', { name: 'Nieuw voorstel' }))
  expect(kaarten()).toHaveLength(3)
})

test('een leeg menu vastzetten kan; daarna verschijnt vanzelf een voorstel', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA)]), sha: 's' }
  await toon(repo, extra(3))
  await verwijderBevestigd(PASTA)
  await waitFor(() => expect(kaarten()).toHaveLength(0))
  await userEvent.click(screen.getByRole('button', { name: /Op de boodschappenlijst/ }))
  await waitFor(() => expect(repo.geschreven).toHaveLength(1))
  expect(repo.geschreven[0].menu.gerechten).toEqual([])
  await waitFor(() => expect(kaarten()).toHaveLength(3))
})

test('concept ouder dan de vastzetting van de partner vervalt', async () => {
  localStorage.setItem('ffsjeffe.concept', JSON.stringify({ gerechten: [gerecht(PASTA)], sinds: '2026-11-20T08:00:00.000Z' }))
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(WRAPS)]), sha: 's' }
  await toon(repo)
  expect(titels()).toEqual([WRAPS])
  expect(localStorage.getItem('ffsjeffe.concept')).toBeNull()
})

test('gerecht met verwijderd recept wordt niet getoond en niet geboodschapt', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht('Bestaat niet'), gerecht(PASTA)]), sha: 's' }
  await toon(repo)
  expect(titels()).toEqual([PASTA])
  await userEvent.click(screen.getByRole('button', { name: /Op de boodschappenlijst/ }))
  await waitFor(() => expect(repo.geschreven).toHaveLength(1))
  expect(repo.geschreven[0].menu.gerechten.map((g) => g.receptId)).toEqual([PASTA])
})

test('VerouderdFout toont melding en Herladen', async () => {
  const repo = new NepRepo()
  repo.zetFout = new VerouderdFout()
  const { herlaad } = await toon(repo, extra(3))
  await userEvent.click(screen.getByRole('button', { name: /Op de boodschappenlijst/ }))
  expect(await screen.findByText('Iemand anders heeft het menu net aangepast. Herlaad en probeer opnieuw.')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Herladen' }))
  expect(herlaad).toHaveBeenCalled()
})

test('pull-to-refresh: omlaag trekken bovenaan herlaadt', async () => {
  const { herlaad } = await toon(new NepRepo(), extra(3))
  const vlak = screen.getByTestId('menu')
  fireEvent.touchStart(vlak, { touches: [{ clientY: 10 }] })
  fireEvent.touchMove(vlak, { touches: [{ clientY: 140 }] })
  expect(screen.getByText('Loslaten om te verversen')).toBeTruthy()
  fireEvent.touchEnd(vlak)
  expect(herlaad).toHaveBeenCalledTimes(1)
  fireEvent.touchStart(vlak, { touches: [{ clientY: 10 }] })
  fireEvent.touchMove(vlak, { touches: [{ clientY: 40 }] })
  fireEvent.touchEnd(vlak)
  expect(herlaad).toHaveBeenCalledTimes(1)
})

test('twee keer snel verwijderen haalt beide weg', async () => {
  await toon(new NepRepo(), extra(3))
  const [a, b, c] = titels()
  await verwijderBevestigd(a)
  await verwijderBevestigd(b)
  await waitFor(() => expect(titels()).toEqual([c]))
  await new Promise((r) => setTimeout(r, 500))
  expect(titels()).toEqual([c])
})

test('Nieuw voorstel geeft andere gerechten dan net weggeveegd', async () => {
  await toon(new NepRepo(), extra(8))
  const voor = titels()
  for (const t of voor) await verwijderBevestigd(t)
  await waitFor(() => expect(kaarten()).toHaveLength(0))
  await userEvent.click(screen.getByRole('button', { name: 'Nieuw voorstel' }))
  expect(kaarten()).toHaveLength(3)
  expect(titels().sort()).not.toEqual([...voor].sort())
})

test('batchgerecht toont porties; eters en avonden zijn los te plussen', async () => {
  const repo = new NepRepo()
  const bolo = recept('Bolognesesaus', [ing('gehakt', 750, 'g')], { porties: 12, avonden: 3 })
  repo.menu_ = { menu: menu([gerecht('Bolognesesaus', 4, { avonden: 3 })]), sha: 's' }
  await toon(repo, [bolo])
  expect(screen.getByText(/12 porties/)).toBeTruthy()
  expect(screen.getByLabelText('avonden').textContent).toBe('3')
  await userEvent.click(screen.getByRole('button', { name: 'Meer avonden' }))
  expect(screen.getByText(/16 porties/)).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Meer eters' }))
  expect(screen.getByText(/20 porties/)).toBeTruthy()
})

test('avonden: minimaal 1, en één avond toont geen porties-regel', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA, 4, { avonden: 2 })]), sha: 's' }
  await toon(repo)
  await userEvent.click(screen.getByRole('button', { name: 'Minder avonden' }))
  expect(screen.getByLabelText('avonden').textContent).toBe('1')
  expect(screen.queryByText(/porties/)).toBeNull()
  expect((screen.getByRole('button', { name: 'Minder avonden' }) as HTMLButtonElement).disabled).toBe(true)
})

test('avonden wijzigen verandert de boodschappen', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA, 4, { avonden: 1 })]), sha: 's' }
  await toon(repo)
  await userEvent.click(screen.getByRole('button', { name: /Boodschappen/ }))
  expect(screen.getByText('Pasta 400 g')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Meer avonden' }))
  expect(screen.getByText('Pasta 800 g')).toBeTruthy()
})

test('voorstel en erbij zetten nemen de standaard avonden van het recept over', async () => {
  const repo = new NepRepo()
  const bolo = recept('Bolognesesaus', [ing('gehakt', 750, 'g')], { porties: 12, avonden: 3 })
  await toon(repo, [...extra(2), bolo]) // 2 voorbeeldrecepten + 2 extra + bolo = 5
  const boloKaart = () => kaarten().find((k) => within(k).queryByRole('link', { name: 'Bolognesesaus' }))
  for (let i = 0; i < 4 && !boloKaart(); i++) {
    await userEvent.click(screen.getByRole('button', { name: /Gerecht erbij/ }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Erbij' }))
    await waitFor(() => expect(kaarten().length).toBe(4 + i))
  }
  expect(within(boloKaart()!).getByLabelText('avonden').textContent).toBe('3')
})

test('oud menu zonder avonden valt terug op de standaard van het recept', async () => {
  const repo = new NepRepo()
  const bolo = recept('Bolognesesaus', [ing('gehakt', 750, 'g')], { porties: 12, avonden: 3 })
  const oud = { receptId: 'Bolognesesaus', eters: 4, gegetenOp: null, vorigeKeer: null } as unknown as ReturnType<typeof gerecht>
  repo.menu_ = { menu: menu([oud]), sha: 's' }
  await toon(repo, [bolo])
  expect(screen.getByLabelText('avonden').textContent).toBe('3')
  expect(screen.getByText(/12 porties/)).toBeTruthy()
})
