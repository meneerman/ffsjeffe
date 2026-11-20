import type { Gerecht, Menu } from './types'

/** YYYY-MM-DD van dit moment in Europe/Amsterdam. */
export function datumNL(nu: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(nu)
}

/** Zaad voor de vaste willekeur van het voorstel: zelfde (lege) menu = zelfde voorstel. */
export function zaadVoor(menu: Menu | null): string {
  return menu?.leegmakenOp ?? menu?.vastgezetOp ?? 'ffsjeffe'
}

export function vastzetten(oud: Menu | null, gerechten: Gerecht[], boodschappen: string[], door: string, nu: Date): Menu {
  const nieuweRonde = !oud || oud.gerechten.length === 0
  const eerder = new Map((oud?.gerechten ?? []).map((g) => [g.receptId, g]))
  return {
    versie: 2,
    ronde: nieuweRonde ? nu.toISOString() : oud.ronde,
    gerechten: gerechten.map((g) => {
      const e = eerder.get(g.receptId)
      return { ...g, gegetenOp: e?.gegetenOp ?? g.gegetenOp, vorigeKeer: e?.vorigeKeer ?? g.vorigeKeer }
    }),
    boodschappen,
    vastgezetOp: nu.toISOString(),
    door,
    leegmakenOp: oud?.leegmakenOp ?? null,
    laatstGegeten: { ...(oud?.laatstGegeten ?? {}) },
  }
}

export function markeerGegeten(menu: Menu, receptId: string, gegeten: boolean, nu: Date): Menu {
  const laatstGegeten = { ...menu.laatstGegeten }
  const gerechten = menu.gerechten.map((g) => {
    if (g.receptId !== receptId) return g
    if (gegeten) {
      const vorigeKeer = menu.laatstGegeten[receptId] ?? null
      laatstGegeten[receptId] = datumNL(nu)
      return { ...g, gegetenOp: datumNL(nu), vorigeKeer }
    }
    if (g.vorigeKeer) laatstGegeten[receptId] = g.vorigeKeer
    else delete laatstGegeten[receptId]
    return { ...g, gegetenOp: null, vorigeKeer: null }
  })
  return { ...menu, gerechten, laatstGegeten }
}

export function leegmaken(oud: Menu | null, door: string, nu: Date): Menu {
  return {
    versie: 2,
    ronde: oud?.ronde ?? nu.toISOString(),
    gerechten: [],
    boodschappen: [],
    vastgezetOp: nu.toISOString(),
    door,
    leegmakenOp: nu.toISOString(),
    laatstGegeten: { ...(oud?.laatstGegeten ?? {}) },
  }
}
