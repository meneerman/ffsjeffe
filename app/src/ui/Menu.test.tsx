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

const drie = () => [gerecht('Extra 0', 2), gerecht('Extra 1', 2), gerecht('Extra 2', 2)]

/** Gerechten in Plannen (het concept); met `menuVelden` bestaat er ook een (leeg) menu, bijv. voor laatstGegeten. */
function plan(repo: NepRepo, gerechten: ReturnType<typeof gerecht>[], menuVelden?: Partial<MenuT>) {
  repo.concept_ = { concept: { gerechten, sinds: '2026-11-21T09:00:00.000Z', door: 'Partner' }, sha: 'c0' }
  if (menuVelden) repo.menu_ = { menu: menu([], menuVelden), sha: 's' }
}

async function toon(repo: NepRepo, recepten: Recept[] = [], herlaad = vi.fn(), modus: 'plannen' | 'standaard' = 'plannen') {
  repo.recepten_ = [...repo.recepten_, ...recepten]
  const r = await repo.recepten()
  const data: AppData = { ...r, menu: repo.menu_, instellingen: { huishouden: 2 }, keepStatus: repo.status_, concept: repo.concept_ }
  function Houder() {
    const [d, setD] = useState(data)
    return <Menu data={d} repo={repo} naam="Menno" herlaad={herlaad} bijgewerkt={(menu) => setD((x) => ({ ...x, menu }))} hash="#/" nu={() => NU} bewaarVertraging={0} />
  }
  render(<Houder />)
  // een vastgezet menu opent in Bereiden; de meeste tests gaan over het plannen
  const tab = screen.queryByRole('tab', { name: 'Plannen' })
  if (tab && modus === 'plannen') fireEvent.click(tab)
  return { data, herlaad }
}
/** Op de boodschappenlijst drukken en in het bevestigscherm bevestigen. */
async function vastzetKnop() {
  await userEvent.click(screen.getByRole('button', { name: /Op de boodschappenlijst/ }))
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Naar Keep sturen' })).getByRole('button', { name: 'Ja, naar Keep' }))
}
async function verwijderBevestigd(titel: string) {
  await userEvent.click(screen.getByRole('button', { name: `Verwijder ${titel}` }))
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Weet je het zeker?' })).getByRole('button', { name: 'Verwijderen' }))
}
const kaarten = () => screen.queryAllByTestId('gerecht')
const titels = () => kaarten().map((k) => within(k).getByRole('link').textContent)

test('x dagen geleden', async () => {
  const repo = new NepRepo()
  plan(repo, [gerecht(PASTA)], { laatstGegeten: { [PASTA]: '2026-11-03' } })
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
  await waitFor(() => expect(kaarten()).toHaveLength(1))
  for (let i = 0; i < 2; i++) {
    await userEvent.click(screen.getByRole('button', { name: /Gerecht erbij/ }))
    await userEvent.click(within(dlg()).getByRole('button', { name: 'Erbij' }))
    await waitFor(() => expect(kaarten()).toHaveLength(2 + i))
  }
})

test('verwijderen vraagt eerst om bevestiging', async () => {
  const repo = new NepRepo()
  plan(repo, drie())
  await toon(repo, extra(3))
  const voor = titels()
  await userEvent.click(screen.getByRole('button', { name: `Verwijder ${voor[1]}` }))
  const vraag = screen.getByRole('dialog', { name: 'Weet je het zeker?' })
  await userEvent.click(within(vraag).getByRole('button', { name: 'Annuleren' }))
  expect(titels()).toEqual(voor)
  await verwijderBevestigd(voor[1])
  await waitFor(() => expect(titels()).toEqual([voor[0], voor[2]]))
})

test('geen veeglaag meer onder de kaarten', async () => {
  await toon(new NepRepo(), extra(3))
  expect(document.querySelector('.veeg-achter')).toBeNull()
})

test('eters − + passen eters en boodschappen aan, minimaal 1', async () => {
  const repo = new NepRepo()
  plan(repo, [gerecht(PASTA, 2)])
  await toon(repo)
  expect(screen.getByText('Pasta 200 g')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Meer eters' }))
  expect(screen.getByLabelText('eters').textContent).toBe('3')
  expect(screen.getByText('Pasta 300 g')).toBeTruthy()
  for (let i = 0; i < 4; i++) await userEvent.click(screen.getByRole('button', { name: 'Minder eters' }))
  expect(screen.getByLabelText('eters').textContent).toBe('1')
})

test('vastzetten schrijft het menu', async () => {
  const repo = new NepRepo()
  plan(repo, drie())
  const { data, herlaad } = await toon(repo, extra(3))
  const getoond = titels()
  await vastzetKnop()
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
  await toon(repo, extra(3), vi.fn(), 'standaard')
  await userEvent.click(screen.getByRole('button', { name: 'Ronde klaar? Keep leegmaken' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuleren' }))
  expect(repo.geschreven).toHaveLength(0)
  await userEvent.click(screen.getByRole('button', { name: 'Ronde klaar? Keep leegmaken' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Leegmaken' }))
  await waitFor(() => expect(repo.geschreven).toHaveLength(1))
  expect(repo.geschreven[0]).toMatchObject({ sha: 's', bericht: 'Keep leeggemaakt door Menno' })
  expect(repo.geschreven[0].menu).toMatchObject({ gerechten: [], leegmakenOp: NU.toISOString() })
  await screen.findByText('Nog niets gepland')
})

test('gegeten-vinkje alleen op vastgezette gerechten (Bereiden), heen en terug', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA)], { laatstGegeten: { [PASTA]: '2026-10-01' } }), sha: 's' }
  await toon(repo)
  await userEvent.click(screen.getByRole('button', { name: /Gerecht erbij/ }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Erbij' }))
  await waitFor(() => expect(kaarten()).toHaveLength(1))
  expect(screen.queryAllByRole('button', { name: / gegeten$/ })).toHaveLength(0) // in Plannen nog niets gegeten
  fireEvent.click(screen.getByRole('tab', { name: 'Bereiden' }))
  expect(screen.getAllByRole('button', { name: / gegeten$/ })).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: `${PASTA} gegeten` }))
  await screen.findByText('✓ gegeten vandaag')
  const w = repo.geschreven[0]
  expect(w.bericht).toBe(`${PASTA} gegeten — Menno`)
  expect(w.menu.laatstGegeten[PASTA]).toBe('2026-11-21')
  expect(w.menu.gerechten[0]).toMatchObject({ gegetenOp: '2026-11-21', vorigeKeer: '2026-10-01' })
  await userEvent.click(screen.getByRole('button', { name: `${PASTA} gegeten` }))
  await waitFor(() => expect(repo.geschreven).toHaveLength(2))
  expect(repo.geschreven[1].menu.laatstGegeten[PASTA]).toBe('2026-10-01')
})

test('met niets in Plannen kun je niet vastzetten', async () => {
  const repo = new NepRepo()
  plan(repo, [gerecht(PASTA)])
  await toon(repo, extra(3))
  await verwijderBevestigd(PASTA)
  await waitFor(() => expect(kaarten()).toHaveLength(0))
  expect((screen.getByRole('button', { name: /Op de boodschappenlijst/ }) as HTMLButtonElement).disabled).toBe(true)
})

test('concept ouder dan de vastzetting van de partner vervalt', async () => {
  localStorage.setItem('ffsjeffe.concept', JSON.stringify({ gerechten: [gerecht(PASTA)], sinds: '2026-11-20T08:00:00.000Z' }))
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(WRAPS)]), sha: 's' }
  await toon(repo)
  expect(titels()).toEqual([]) // wat al vastgezet is staat in Bereiden
  expect(localStorage.getItem('ffsjeffe.concept')).toBeNull()
})

test('gerecht met verwijderd recept wordt niet getoond en niet geboodschapt', async () => {
  const repo = new NepRepo()
  plan(repo, [gerecht('Bestaat niet'), gerecht(PASTA)])
  await toon(repo)
  expect(titels()).toEqual([PASTA])
  await vastzetKnop()
  await waitFor(() => expect(repo.geschreven).toHaveLength(1))
  expect(repo.geschreven[0].menu.gerechten.map((g) => g.receptId)).toEqual([PASTA])
})

test('VerouderdFout toont melding en Herladen', async () => {
  const repo = new NepRepo()
  repo.zetFout = new VerouderdFout()
  plan(repo, drie())
  const { herlaad } = await toon(repo, extra(3))
  await vastzetKnop()
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
  const repo = new NepRepo()
  plan(repo, drie())
  await toon(repo, extra(3))
  const [a, b, c] = titels()
  await verwijderBevestigd(a)
  await verwijderBevestigd(b)
  await waitFor(() => expect(titels()).toEqual([c]))
  await new Promise((r) => setTimeout(r, 500))
  expect(titels()).toEqual([c])
})

test('batchgerecht toont porties; eters en avonden zijn los te plussen', async () => {
  const repo = new NepRepo()
  const bolo = recept('Bolognesesaus', [ing('gehakt', 750, 'g')], { porties: 12, avonden: 3 })
  plan(repo, [gerecht('Bolognesesaus', 4, { avonden: 3 })])
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
  plan(repo, [gerecht(PASTA, 4, { avonden: 2 })])
  await toon(repo)
  await userEvent.click(screen.getByRole('button', { name: 'Minder avonden' }))
  expect(screen.getByLabelText('avonden').textContent).toBe('1')
  expect(screen.queryByText(/porties/)).toBeNull()
  expect((screen.getByRole('button', { name: 'Minder avonden' }) as HTMLButtonElement).disabled).toBe(true)
})

test('avonden wijzigen verandert de boodschappen', async () => {
  const repo = new NepRepo()
  plan(repo, [gerecht(PASTA, 4, { avonden: 1 })])
  await toon(repo)
  expect(screen.getByText('Pasta 400 g')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Meer avonden' }))
  expect(screen.getByText('Pasta 800 g')).toBeTruthy()
})

test('erbij zetten neemt de standaard avonden van het recept over', async () => {
  const repo = new NepRepo()
  const bolo = recept('Bolognesesaus', [ing('gehakt', 750, 'g')], { porties: 12, avonden: 3 })
  await toon(repo, [...extra(2), bolo]) // 2 voorbeeldrecepten + 2 extra + bolo = 5
  const boloKaart = () => kaarten().find((k) => within(k).queryByRole('link', { name: 'Bolognesesaus' }))
  for (let i = 0; i < 5 && !boloKaart(); i++) {
    await userEvent.click(screen.getByRole('button', { name: /Gerecht erbij/ }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Erbij' }))
    await waitFor(() => expect(kaarten().length).toBe(1 + i))
  }
  expect(within(boloKaart()!).getByLabelText('avonden').textContent).toBe('3')
})

test('oud menu zonder avonden valt terug op de standaard van het recept', async () => {
  const repo = new NepRepo()
  const bolo = recept('Bolognesesaus', [ing('gehakt', 750, 'g')], { porties: 12, avonden: 3 })
  const oud = { receptId: 'Bolognesesaus', eters: 4, gegetenOp: null, vorigeKeer: null } as unknown as ReturnType<typeof gerecht>
  plan(repo, [oud])
  await toon(repo, [bolo])
  expect(screen.getByLabelText('avonden').textContent).toBe('3')
  expect(screen.getByText(/12 porties/)).toBeTruthy()
})

test('tip om een pak op te maken: één tik zet eters/avonden, daarna weg', async () => {
  const repo = new NepRepo()
  const saus = recept('Romige saus', [ing('crème fraîche', 150, 'ml')], { porties: 4 }) // 4 eters: 150 van 200 ml
  plan(repo, [gerecht('Romige saus', 4)])
  await toon(repo, [saus])
  const tip = screen.getByRole('button', { name: 'Pak crème fraîche op: 5 eters · 5 porties' })
  await userEvent.click(tip)
  expect(screen.getByLabelText('eters').textContent).toBe('5')
  expect(screen.queryByRole('button', { name: /^Pak .* op:/ })).toBeNull()
})

test('tip bij een batch zegt dat de avonden veranderen', async () => {
  const repo = new NepRepo()
  const bolo = recept('Bolognesesaus', [ing('crème fraîche', 150, 'ml')], { porties: 12, avonden: 3 }) // 4×3: 150 van 200 ml
  plan(repo, [gerecht('Bolognesesaus', 4, { avonden: 3 })])
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
  expect(within(screen.getByTestId('menu')).getByRole('link', { name: 'Instellingen' }).getAttribute('href')).toBe('#/instellingen')
})

test('invriesbaar gerecht krijgt een ❄ op de kaart', async () => {
  const repo = new NepRepo()
  plan(repo, [gerecht('Soep', 4)])
  await toon(repo, [recept('Soep', [ing('linzen', 400, 'g')], { invriezen: true })])
  expect(within(kaarten()[0]).getByText(/❄ invriesbaar/)).toBeTruthy()
})

// ---- doorswipen ----
const kaartDiv = (i: number) => kaarten()[i]

test('wijzigingen worden automatisch bewaard als gedeeld concept, niet naar Keep gestuurd', async () => {
  const repo = new NepRepo()
  plan(repo, drie())
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
  expect(titels()).toEqual([])
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
  plan(repo, drie())
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
  plan(repo, drie())
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
  const data: AppData = { ...r, menu: null, instellingen: { huishouden: 2 }, keepStatus: null, concept: { concept: { gerechten: drie(), sinds: '2026-11-21T09:00:00.000Z', door: 'P' }, sha: 'c' } }
  const { unmount } = render(<Menu data={data} repo={repo} naam="Menno" herlaad={() => {}} bijgewerkt={() => {}} hash="#/" nu={() => NU} bewaarVertraging={60_000} />)
  await userEvent.click(within(kaartDiv(0)).getByRole('button', { name: 'Meer eters' }))
  expect(repo.conceptGeschreven).toHaveLength(0)
  unmount()
  await waitFor(() => expect(repo.conceptGeschreven).toHaveLength(1))
})

test('de Keep-melding (bijwerken) staat alleen in Bereiden, nooit in Plannen', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA, 2)], { boodschappen: ['Pasta 200 g'] }), sha: 's' }
  repo.status_ = { tijd: '2026-11-19T10:05:00.000Z', ok: true, melding: '', weken: [] }
  await toon(repo, extra(3), vi.fn(), 'standaard')
  expect(screen.getByText('Keep bijwerken…')).toBeTruthy()
  await userEvent.click(screen.getByRole('tab', { name: 'Plannen' }))
  expect(screen.queryByText('Keep bijwerken…')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Gerecht erbij/ }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Erbij' }))
  await waitFor(() => expect(kaarten()).toHaveLength(1))
  expect(screen.queryByText('Keep bijwerken…')).toBeNull()
  expect(screen.getByText(/nog niet op Keep/)).toBeTruthy()
  expect(repo.geschreven).toHaveLength(0)
})

test('de Keep-melding niet bij een leeggemaakt menu of een lege lijst', async () => {
  const status = { tijd: '2026-11-19T10:05:00.000Z', ok: true, melding: '', weken: [] }
  const leeg = new NepRepo()
  leeg.menu_ = { menu: menu([], { leegmakenOp: '2026-11-20T11:00:00.000Z', boodschappen: [] }), sha: 's' }
  leeg.status_ = status
  await toon(leeg, extra(3))
  expect(screen.queryByText('Keep bijwerken…')).toBeNull()
  cleanup()
  const nietsOpLijst = new NepRepo()
  nietsOpLijst.menu_ = { menu: menu([gerecht(PASTA, 2)], { boodschappen: [] }), sha: 's' }
  nietsOpLijst.status_ = status
  await toon(nietsOpLijst, [], vi.fn(), 'standaard')
  expect(screen.queryByText('Keep bijwerken…')).toBeNull()
})

// ---- bereiden-modus ----
const vastgezet = (): NepRepo => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA, 4, { avonden: 2 }), gerecht(WRAPS, 4)], { boodschappen: ['Pasta 800 g'] }), sha: 's' }
  repo.status_ = { tijd: '2026-11-20T10:05:00.000Z', ok: true, melding: '', weken: [] }
  return repo
}

test('vastgezet menu zonder concept opent in bereiden: kookkaarten, geen plan-knoppen', async () => {
  const repo = vastgezet()
  await toon(repo, [], vi.fn(), 'standaard')
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ffsjeffe')
  expect(screen.getByText('Wat we bereiden')).toBeTruthy()
  expect(titels()).toEqual([PASTA, WRAPS])
  expect(screen.queryByText('Staat in Keep ✓')).toBeNull() // al eerder bijgewerkt: geen blijvende bevestiging
  expect(screen.queryByRole('button', { name: /Op de boodschappenlijst/ })).toBeNull()
  expect(screen.queryByLabelText('eters')).toBeNull()
  expect(screen.queryByRole('button', { name: /^Verwijder / })).toBeNull()
  expect(screen.queryByRole('button', { name: /Ander gerecht/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Gerecht erbij/ })).toBeNull()
  expect(within(kaarten()[0]).getByText(/2 avonden/)).toBeTruthy()
  expect(screen.getByRole('button', { name: /Keep leegmaken/ })).toBeTruthy()
})

test('bereiden: gegeten afvinken schrijft het menu, gegeten gaat onderaan', async () => {
  const repo = vastgezet()
  await toon(repo, [], vi.fn(), 'standaard')
  await userEvent.click(screen.getByRole('button', { name: `${PASTA} gegeten` }))
  await waitFor(() => expect(repo.geschreven).toHaveLength(1))
  expect(repo.geschreven[0].menu.laatstGegeten[PASTA]).toBeTruthy()
  await waitFor(() => expect(titels()).toEqual([WRAPS, PASTA]))
  expect(screen.getByText(/1 van 2 gegeten/)).toBeTruthy()
})

test('bereiden toont de ingrediënten die in Keep staan, niet een nieuwe berekening', async () => {
  await toon(vastgezet(), [], vi.fn(), 'standaard')
  await userEvent.click(screen.getByRole('button', { name: /In huis/ }))
  expect(screen.getByText('Pasta 800 g')).toBeTruthy()
})

test('schakelaar Plannen laat het menu bewerken; een wijziging maakt een concept, Bereiden blijft het vastgezette menu tonen', async () => {
  const repo = vastgezet()
  await toon(repo, extra(3), vi.fn(), 'standaard')
  await userEvent.click(screen.getByRole('tab', { name: 'Plannen' }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ffsjeffe')
  expect(screen.getByText('Wat eten we deze keer?')).toBeTruthy()
  expect(kaarten()).toHaveLength(0) // het vastgezette menu staat alleen in Bereiden
  await userEvent.click(screen.getByRole('button', { name: /Gerecht erbij/ }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Erbij' }))
  await screen.findByText(/Concept van Menno/)
  expect(screen.getByRole('button', { name: /Op de boodschappenlijst/ })).toBeTruthy()
  await userEvent.click(screen.getByRole('tab', { name: 'Bereiden' }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ffsjeffe')
  expect(screen.getByText('Wat we bereiden')).toBeTruthy()
  expect(within(kaarten()[0]).queryByLabelText('eters')).toBeNull()
  expect(repo.geschreven).toHaveLength(0)
})

test('een concept (ook van de ander) opent in Plannen; zonder vastgezet menu is er geen schakelaar', async () => {
  const repo = vastgezet()
  repo.concept_ = { concept: { gerechten: [gerecht(WRAPS, 5)], sinds: '2026-11-21T09:00:00.000Z', door: 'Partner' }, sha: 'c0' }
  await toon(repo, [], vi.fn(), 'standaard')
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ffsjeffe')
  expect(screen.getByText('Wat eten we deze keer?')).toBeTruthy()
  expect(screen.getByRole('tab', { name: 'Bereiden' })).toBeTruthy()
  cleanup()
  await toon(new NepRepo(), extra(3))
  expect(screen.queryByRole('tab')).toBeNull()
})

test('na op de boodschappenlijst drukken ga je naar bereiden', async () => {
  const repo = new NepRepo()
  plan(repo, drie())
  await toon(repo, extra(3))
  await vastzetKnop()
  await screen.findByText('Wat we bereiden')
})

test('verwijderen vraagt "Weet je het zeker?"; annuleren laat het gerecht staan', async () => {
  const repo = new NepRepo()
  plan(repo, [gerecht(PASTA), gerecht(WRAPS)])
  await toon(repo)
  await userEvent.click(screen.getByRole('button', { name: `Verwijder ${PASTA}` }))
  const dlg = screen.getByRole('dialog', { name: 'Weet je het zeker?' })
  expect(within(dlg).getByText(new RegExp(PASTA))).toBeTruthy()
  await userEvent.click(within(dlg).getByRole('button', { name: 'Annuleren' }))
  expect(screen.queryByRole('dialog', { name: 'Weet je het zeker?' })).toBeNull()
  expect(titels()).toContain(PASTA)
  await verwijderBevestigd(PASTA)
  await waitFor(() => expect(titels()).toEqual([WRAPS]))
})

test('boodschappen staan per categorie open; wat je uitvinkt gaat niet naar Keep', async () => {
  const repo = new NepRepo()
  plan(repo, [gerecht(PASTA, 2), gerecht(WRAPS, 2)])
  await toon(repo)
  expect(screen.getByRole('heading', { name: 'Olie, sauzen & azijn' })).toBeTruthy()
  await userEvent.click(screen.getByRole('checkbox', { name: /^Olijfolie/ }))
  await vastzetKnop()
  await screen.findByText(/Vastgezet door Menno/)
  const regels = repo.geschreven[0].menu.boodschappen
  expect(regels.some((r) => r.startsWith('Olijfolie'))).toBe(false)
  expect(regels.some((r) => r.startsWith('Pasta'))).toBe(true)
})

test('alles uitvinken en toch vastzetten schrijft een lege lijst zonder fout', async () => {
  const repo = new NepRepo()
  plan(repo, [gerecht(PASTA, 2)])
  await toon(repo)
  for (const vak of screen.getAllByRole('checkbox')) await userEvent.click(vak)
  await vastzetKnop()
  await screen.findByText(/Vastgezet door Menno/)
  expect(repo.geschreven[0].menu.boodschappen).toEqual([])
})

test('na een gewijzigd aantal eters staat de nieuwe regel weer aangevinkt', async () => {
  const repo = new NepRepo()
  plan(repo, [gerecht(PASTA, 2)])
  await toon(repo)
  await userEvent.click(screen.getByRole('checkbox', { name: 'Pasta 200 g' }))
  await userEvent.click(screen.getByRole('button', { name: 'Meer eters' }))
  expect((screen.getByRole('checkbox', { name: 'Pasta 300 g' }) as HTMLInputElement).checked).toBe(true)
})

test('geen "ffsjeffe · menu" meer boven de kop', async () => {
  await toon(new NepRepo(), extra(3))
  expect(screen.queryByText('ffsjeffe · menu')).toBeNull()
})

test('de schakelaar staat op volgorde Plannen, Bereiden', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA, 2)]), sha: 's' }
  await toon(repo)
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Plannen', 'Bereiden'])
})

test('na vastzetten is Plannen leeg: de vastgezette gerechten staan alleen in Bereiden', async () => {
  const repo = vastgezet()
  await toon(repo, [], vi.fn(), 'plannen')
  expect(kaarten()).toHaveLength(0)
  expect(screen.queryByRole('link', { name: PASTA })).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: 'Bereiden' }))
  expect(screen.getByRole('link', { name: PASTA })).toBeTruthy()
})

test('nieuwe gerechten komen bij het vastgezette menu; alleen de nieuwe regels staan in het nalopen', async () => {
  const repo = new NepRepo()
  const perId = Object.fromEntries(repo.recepten_.map((r) => [r.id, r]))
  const oud = [gerecht(PASTA, 2)]
  const oudeRegels = boodschappenRegels(behoeften(oud, perId), (await repo.recepten()).verpakkingen)
  repo.menu_ = { menu: menu(oud, { boodschappen: oudeRegels }), sha: 's' }
  repo.concept_ = { concept: { gerechten: [gerecht(WRAPS, 2)], sinds: '2026-11-21T09:00:00.000Z', door: 'Partner' }, sha: 'c0' }
  await toon(repo)
  expect(kaarten()).toHaveLength(1)
  expect(screen.queryByRole('checkbox', { name: /^Pasta/ })).toBeNull() // staat al op Keep
  expect(screen.getByRole('checkbox', { name: /^Kipfilet/ })).toBeTruthy()
  await vastzetKnop()
  await screen.findByText(/Vastgezet door Menno/)
  const m = repo.geschreven[0].menu
  expect(m.gerechten.map((g) => g.receptId)).toEqual([PASTA, WRAPS])
  expect(m.ronde).toBe('2026-11-20T10:00:00.000Z') // zelfde ronde, geen nieuwe
  expect(m.boodschappen.some((r) => r.startsWith('Pasta'))).toBe(true)
  expect(m.boodschappen.some((r) => r.startsWith('Kipfilet'))).toBe(true)
})

test('een gerecht dat al vastgezet is en opnieuw wordt gekozen, vervangt het oude (niet dubbel)', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([gerecht(PASTA, 2)], { boodschappen: [] }), sha: 's' }
  repo.concept_ = { concept: { gerechten: [gerecht(PASTA, 4)], sinds: '2026-11-21T09:00:00.000Z', door: 'Partner' }, sha: 'c0' }
  await toon(repo)
  await vastzetKnop()
  await screen.findByText(/Vastgezet door Menno/)
  expect(repo.geschreven[0].menu.gerechten.map((g) => [g.receptId, g.eters])).toEqual([[PASTA, 4]])
})

test('op de boodschappenlijst vraagt eerst "Weet je het zeker?": annuleren schrijft niets', async () => {
  const repo = new NepRepo()
  plan(repo, [gerecht(PASTA, 2)])
  await toon(repo)
  await userEvent.click(screen.getByRole('button', { name: /Op de boodschappenlijst/ }))
  const dlg = screen.getByRole('dialog', { name: 'Naar Keep sturen' })
  expect(within(dlg).getByText('Weet je het zeker?')).toBeTruthy()
  await userEvent.click(within(dlg).getByRole('button', { name: 'Annuleren' }))
  expect(screen.queryByRole('dialog', { name: 'Naar Keep sturen' })).toBeNull()
  expect(repo.geschreven).toHaveLength(0)
})

test('in het bevestigscherm kun je nog uitvinken; dat gaat niet naar Keep', async () => {
  const repo = new NepRepo()
  plan(repo, [gerecht(PASTA, 2), gerecht(WRAPS, 2)])
  await toon(repo)
  await userEvent.click(screen.getByRole('button', { name: /Op de boodschappenlijst/ }))
  const dlg = screen.getByRole('dialog', { name: 'Naar Keep sturen' })
  await userEvent.click(within(dlg).getByRole('checkbox', { name: /^Olijfolie/ }))
  await userEvent.click(within(dlg).getByRole('button', { name: 'Ja, naar Keep' }))
  await screen.findByText(/Vastgezet door Menno/)
  const regels = repo.geschreven[0].menu.boodschappen
  expect(regels.some((r) => r.startsWith('Olijfolie'))).toBe(false)
  expect(regels.some((r) => r.startsWith('Pasta'))).toBe(true)
})

test('de merknaam is ff (wit, even) en sjeffe (paars, chef)', async () => {
  await toon(new NepRepo(), extra(3))
  const kop = screen.getByRole('heading', { level: 1 })
  expect(kop.textContent).toBe('ffsjeffe')
  expect(kop.querySelector('em')?.textContent).toBe('sjeffe')
})

test('leeg Plannen: geen voorstel, "Nog niets gepland", geen Nieuw voorstel', async () => {
  await toon(new NepRepo(), extra(3))
  expect(kaarten()).toHaveLength(0)
  expect(screen.getByText('Nog niets gepland')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Nieuw voorstel' })).toBeNull()
  expect(screen.getByRole('link', { name: '☰ Alle recepten' }).getAttribute('href')).toBe('#/recepten')
})

test('kaarten in Plannen hebben geen vegen of ⇄ meer', async () => {
  const repo = new NepRepo()
  plan(repo, [gerecht(PASTA, 2), gerecht(WRAPS, 2)])
  await toon(repo, extra(3))
  expect(screen.queryByRole('button', { name: /Ander gerecht/ })).toBeNull()
})

test('Keep leegmaken staat niet in Plannen maar als link onderaan Bereiden zolang er een ronde loopt', async () => {
  const repo = vastgezet()
  await toon(repo, [], vi.fn(), 'standaard')
  await userEvent.click(screen.getByRole('button', { name: 'Ronde klaar? Keep leegmaken' }))
  expect(screen.getByRole('dialog', { name: 'Keep leegmaken' })).toBeTruthy()
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Keep leegmaken' })).getByRole('button', { name: 'Annuleren' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Keep leegmaken' })).toBeNull())
  await userEvent.click(screen.getByRole('tab', { name: 'Plannen' }))
  expect(screen.queryByRole('button', { name: /Keep leegmaken/ })).toBeNull()
})

test('zonder lopende ronde geen Keep leegmaken', async () => {
  const repo = new NepRepo()
  repo.menu_ = { menu: menu([], { boodschappen: [], leegmakenOp: '2026-11-20T11:00:00.000Z' }), sha: 's' }
  await toon(repo, extra(3))
  expect(screen.queryByRole('button', { name: /Keep leegmaken/ })).toBeNull()
})

test('stapel: twee keer snel Nee slaat precies twee kaarten over', async () => {
  await toon(new NepRepo(), extra(6))
  await userEvent.click(screen.getByRole('button', { name: /Gerecht erbij/ }))
  const dlg = () => screen.getByRole('dialog', { name: 'Gerecht toevoegen' })
  const boven = () => within(dlg()).getByTestId('bovenste').querySelector('h2')!.textContent
  const eerste = boven()
  const tweede = within(dlg()).getAllByTestId('deck-kaart')[0].querySelector('h2')!.textContent
  fireEvent.click(within(dlg()).getByRole('button', { name: 'Nee' }))
  fireEvent.click(within(dlg()).getByRole('button', { name: 'Nee' }))
  await waitFor(() => expect([eerste, tweede]).not.toContain(boven()))
})

test('stapel: Erbij vlak na Nee zet precies de volgende kaart erbij', async () => {
  await toon(new NepRepo(), extra(6))
  await userEvent.click(screen.getByRole('button', { name: /Gerecht erbij/ }))
  const dlg = () => screen.getByRole('dialog', { name: 'Gerecht toevoegen' })
  const tweede = within(dlg()).getAllByTestId('deck-kaart')[0].querySelector('h2')!.textContent
  fireEvent.click(within(dlg()).getByRole('button', { name: 'Nee' }))
  fireEvent.click(within(dlg()).getByRole('button', { name: 'Erbij' }))
  await waitFor(() => expect(titels()).toEqual([tweede]))
})

test('vooraf staat kort bij de gegevens van het gerecht, in Plannen en in Bereiden', async () => {
  const repo = new NepRepo()
  repo.recepten_ = repo.recepten_.map((r) => (r.id === PASTA ? { ...r, vooraf: 'een nacht weken' } : r))
  plan(repo, [gerecht(PASTA, 2)])
  await toon(repo)
  expect(within(kaarten()[0]).getByText(/⏳ een nacht weken/)).toBeTruthy()
  cleanup()
  const vast = new NepRepo()
  vast.recepten_ = vast.recepten_.map((r) => (r.id === PASTA ? { ...r, vooraf: 'een nacht weken' } : r))
  vast.menu_ = { menu: menu([gerecht(PASTA, 2)], { boodschappen: ['Pasta 200 g'] }), sha: 's' }
  await toon(vast, [], vi.fn(), 'standaard')
  expect(within(kaarten()[0]).getByText(/⏳ een nacht weken/)).toBeTruthy()
})
