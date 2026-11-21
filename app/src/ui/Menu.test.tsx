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
  const data: AppData = { ...r, menu: repo.menu_, instellingen: { huishouden: 2 }, keepStatus: null, concept: repo.concept_ }
  function Houder() {
    const [d, setD] = useState(data)
    return <Menu data={d} repo={repo} naam="Menno" herlaad={herlaad} bijgewerkt={(menu) => setD((x) => ({ ...x, menu }))} hash="#/" nu={() => NU} bewaarVertraging={0} />
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

test('tip om een pak op te maken: één tik zet eters/avonden, daarna weg', async () => {
  const repo = new NepRepo()
  const saus = recept('Romige saus', [ing('crème fraîche', 150, 'ml')], { porties: 4 }) // 4 eters: 150 van 200 ml
  repo.menu_ = { menu: menu([gerecht('Romige saus', 4)]), sha: 's' }
  await toon(repo, [saus])
  const tip = screen.getByRole('button', { name: 'Pak crème fraîche op: 5 eters · 5 porties' })
  await userEvent.click(tip)
  expect(screen.getByLabelText('eters').textContent).toBe('5')
  expect(screen.queryByRole('button', { name: /^Pak .* op:/ })).toBeNull()
})

test('tip bij een batch zegt dat de avonden veranderen', async () => {
  const repo = new NepRepo()
  const bolo = recept('Bolognesesaus', [ing('crème fraîche', 150, 'ml')], { porties: 12, avonden: 3 }) // 4×3: 150 van 200 ml
  repo.menu_ = { menu: menu([gerecht('Bolognesesaus', 4, { avonden: 3 })]), sha: 's' }
  await toon(repo, [bolo])
  await userEvent.click(screen.getByRole('button', { name: 'Pak crème fraîche op: 4 avonden · 16 porties' }))
  expect(screen.getByLabelText('avonden').textContent).toBe('4')
  expect(screen.getByLabelText('eters').textContent).toBe('4')
})

test('stapel: terug-knop haalt het laatst weggeveegde gerecht terug', async () => {
  await toon(new NepRepo(), extra(6))
  await userEvent.click(screen.getByRole('button', { name: /Gerecht erbij/ }))
  const dlg = () => screen.getByRole('dialog')
  const boven = () => within(dlg()).getByTestId('bovenste').querySelector('h2')!.textContent
  expect((within(dlg()).getByRole('button', { name: 'Terug' }) as HTMLButtonElement).disabled).toBe(true)
  const eerste = boven()
  await userEvent.click(within(dlg()).getByRole('button', { name: 'Nee' }))
  await waitFor(() => expect(boven()).not.toBe(eerste))
  await userEvent.click(within(dlg()).getByRole('button', { name: 'Terug' }))
  expect(boven()).toBe(eerste)
})

test('instellingen staat in de kop van het menu', async () => {
  await toon(new NepRepo(), extra(3))
  expect(within(screen.getByTestId('menu')).getByRole('link', { name: 'instellingen' }).getAttribute('href')).toBe('#/instellingen')
})

test('invriesbaar gerecht krijgt een ❄ op de kaart', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht('Soep', 4)]), sha: 's' }
  await toon(repo, [recept('Soep', [ing('linzen', 400, 'g')], { invriezen: true })])
  expect(within(kaarten()[0]).getByText(/❄ invriesbaar/)).toBeTruthy()
})

// ---- doorswipen ----
const kaartDiv = (i: number) => kaarten()[i]
function veeg(kaart: HTMLElement, van: number, naar: number) {
  fireEvent.pointerDown(kaart, { clientX: van, clientY: 100 })
  fireEvent.pointerMove(kaart, { clientX: naar, clientY: 104 })
  fireEvent.pointerUp(kaart, { clientX: naar, clientY: 104 })
}

test('kaart opzij vegen: volgende beste gerecht op dezelfde plek, eters en avonden blijven', async () => {
  await toon(new NepRepo(), extra(6))
  await userEvent.click(within(kaartDiv(0)).getByRole('button', { name: 'Meer eters' }))
  await userEvent.click(within(kaartDiv(0)).getByRole('button', { name: 'Meer avonden' }))
  const voor = titels()
  veeg(kaartDiv(0), 250, 40)
  await waitFor(() => expect(titels()[0]).not.toBe(voor[0]))
  expect(titels().slice(1)).toEqual(voor.slice(1))
  expect(within(kaartDiv(0)).getByLabelText('eters').textContent).toBe('3')
  expect(within(kaartDiv(0)).getByLabelText('avonden').textContent).toBe('2')
  // naar rechts kan ook, en het eerder weggeveegde recept komt niet meteen terug
  const tweede = titels()[0]
  veeg(kaartDiv(0), 40, 250)
  await waitFor(() => expect(titels()[0]).not.toBe(tweede))
  expect(titels()[0]).not.toBe(voor[0])
  expect(new Set(titels()).size).toBe(3)
})

test('kort vegen of vegen zonder alternatief verandert niets, en opent het recept niet', async () => {
  const repo = new NepRepo()
  repo.recepten_ = []
  await toon(repo, extra(3)) // alle 3 staan al op het menu: geen alternatief
  const voor = titels()
  veeg(kaartDiv(0), 100, 60)
  veeg(kaartDiv(0), 250, 40)
  await new Promise((r) => setTimeout(r, 500))
  expect(titels()).toEqual(voor)
  expect(kaarten()).toHaveLength(3)
})

test('ander gerecht-knop doet hetzelfde als vegen', async () => {
  await toon(new NepRepo(), extra(6))
  const voor = titels()
  await userEvent.click(screen.getByRole('button', { name: `Ander gerecht voor ${voor[1]}` }))
  await waitFor(() => expect(titels()[1]).not.toBe(voor[1]))
  expect([titels()[0], titels()[2]]).toEqual([voor[0], voor[2]])
})

// ---- concept bewaren zonder Keep ----
test('wijzigingen worden automatisch bewaard als gedeeld concept, niet naar Keep gestuurd', async () => {
  const repo = new NepRepo()
  await toon(repo, extra(3))
  await userEvent.click(within(kaartDiv(0)).getByRole('button', { name: 'Meer eters' }))
  await waitFor(() => expect(repo.conceptGeschreven.length).toBeGreaterThan(0))
  const c = repo.conceptGeschreven.at(-1)!
  expect(c.door).toBe('Menno')
  expect(c.gerechten[0].eters).toBe(3)
  expect(repo.geschreven).toHaveLength(0) // menu.json (en dus Keep) blijft onaangeroerd
  await screen.findByText(/✓ bewaard/)
  expect(screen.getByText(/nog niet op Keep/)).toBeTruthy()
})

test('concept van de ander verschijnt op dit toestel', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA, 2)], { door: 'Partner' }), sha: 's' }
  repo.concept_ = { concept: { gerechten: [gerecht(WRAPS, 5)], sinds: '2026-11-21T09:00:00.000Z', door: 'Partner' }, sha: 'c0' }
  await toon(repo)
  expect(titels()).toEqual([WRAPS])
  expect(within(kaartDiv(0)).getByLabelText('eters').textContent).toBe('5')
  expect(screen.getByText(/Concept van Partner/)).toBeTruthy()
})

test('concept van voor het laatste vastzetten telt niet meer', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA, 2)]), sha: 's' }
  repo.concept_ = { concept: { gerechten: [gerecht(WRAPS, 5)], sinds: '2026-11-19T09:00:00.000Z', door: 'Partner' }, sha: 'c0' }
  await toon(repo)
  expect(titels()).toEqual([PASTA])
})

test('het nieuwste van lokaal en gedeeld concept wint', async () => {
  const repo = new NepRepo()
  localStorage.setItem('ffsjeffe.concept', JSON.stringify({ gerechten: [gerecht(PASTA, 3)], sinds: '2026-11-21T11:00:00.000Z' }))
  repo.concept_ = { concept: { gerechten: [gerecht(WRAPS, 5)], sinds: '2026-11-21T09:00:00.000Z', door: 'Partner' }, sha: 'c0' }
  await toon(repo)
  expect(titels()).toEqual([PASTA])
})

test('bewaren mislukt: melding en opnieuw proberen', async () => {
  const repo = new NepRepo()
  repo.conceptFout = new Error('GitHub gaf status 500')
  await toon(repo, extra(3))
  await userEvent.click(within(kaartDiv(0)).getByRole('button', { name: 'Meer eters' }))
  await screen.findByText(/Bewaren mislukt/)
  repo.conceptFout = null
  await userEvent.click(screen.getByRole('button', { name: 'Opnieuw bewaren' }))
  await screen.findByText(/✓ bewaard/)
  expect(repo.conceptGeschreven).toHaveLength(1)
})

test('de ander bewaarde net ook: sha verouderd, daarna opnieuw geprobeerd met de nieuwste sha', async () => {
  const repo = new NepRepo()
  await toon(repo, extra(3))
  repo.concept_ = { concept: { gerechten: [], sinds: '2026-11-21T11:59:00.000Z', door: 'Partner' }, sha: 'andermans' }
  await userEvent.click(within(kaartDiv(0)).getByRole('button', { name: 'Meer eters' }))
  await waitFor(() => expect(repo.conceptGeschreven).toHaveLength(1))
  expect(repo.concept_!.concept.door).toBe('Menno')
  expect(repo.concept_!.concept.gerechten).toHaveLength(3)
})

test('wegnavigeren voor het uitstel om is: het concept wordt alsnog meteen bewaard', async () => {
  const repo = new NepRepo()
  repo.recepten_ = [...repo.recepten_, ...extra(3)]
  const r = await repo.recepten()
  const data: AppData = { ...r, menu: null, instellingen: { huishouden: 2 }, keepStatus: null, concept: null }
  const { unmount } = render(<Menu data={data} repo={repo} naam="Menno" herlaad={() => {}} bijgewerkt={() => {}} hash="#/" nu={() => NU} bewaarVertraging={60_000} />)
  await userEvent.click(within(kaartDiv(0)).getByRole('button', { name: 'Meer eters' }))
  expect(repo.conceptGeschreven).toHaveLength(0)
  unmount()
  await waitFor(() => expect(repo.conceptGeschreven).toHaveLength(1))
})
