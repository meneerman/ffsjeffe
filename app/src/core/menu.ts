import type { Batch, Gerecht, Menu, MenuV2 } from './types'

/** YYYY-MM-DD van dit moment in Europe/Amsterdam. */
export function datumNL(nu: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(nu)
}

/** Versie 2 (één ronde) wordt één batch met id = ronde, zodat de Keep-sync en de kookvoortgang gelijk blijven. */
export function migreer(m: Menu | MenuV2): Menu {
  if (m.versie === 3) return m
  return {
    versie: 3,
    batches: m.gerechten.length === 0 && m.boodschappen.length === 0
      ? []
      : [{ id: m.ronde, vastgezetOp: m.vastgezetOp, door: m.door, gerechten: m.gerechten, boodschappen: m.boodschappen }],
    leegmakenOp: m.leegmakenOp,
    laatstGegeten: m.laatstGegeten ?? {},
    beoordelingen: {},
  }
}

/** Tijdstip van de nieuwste batch. */
export function laatsteVastgezetOp(menu: Menu | null): string | null {
  const b = menu?.batches[menu.batches.length - 1]
  return b ? b.vastgezetOp : null
}

/** Moment waarna een gedeeld concept niet meer telt: nieuwste batch of leegmaken, wat het laatst was. */
export function verlooptNa(menu: Menu | null): string | null {
  const a = laatsteVastgezetOp(menu)
  const b = menu?.leegmakenOp ?? null
  if (a && b) return a > b ? a : b
  return a ?? b
}

export const alleGerechten = (menu: Menu | null): Gerecht[] => (menu?.batches ?? []).flatMap((b) => b.gerechten)

/** Zaad voor de vaste willekeur van het voorstel: zelfde (lege) menu = zelfde voorstel. */
export function zaadVoor(menu: Menu | null): string {
  return menu?.leegmakenOp ?? laatsteVastgezetOp(menu) ?? 'ffsjeffe'
}

/** Elke keer naar Keep sturen is een nieuwe batch; bestaande batches blijven zoals ze zijn. */
export function vastzetten(oud: Menu | null, gerechten: Gerecht[], boodschappen: string[], door: string, nu: Date): Menu {
  const batch: Batch = { id: nu.toISOString(), vastgezetOp: nu.toISOString(), door, gerechten, boodschappen }
  return {
    versie: 3,
    batches: [...(oud?.batches ?? []), batch],
    leegmakenOp: oud?.leegmakenOp ?? null,
    laatstGegeten: { ...(oud?.laatstGegeten ?? {}) },
    beoordelingen: { ...(oud?.beoordelingen ?? {}) },
  }
}

/**
 * Gerecht in één batch (on)gegeten. Bij gegeten kan een beoordeling (0..5) mee; terugzetten laat de beoordeling staan
 * en zet laatstGegeten alleen terug als er intussen geen nieuwere datum is.
 */
export function markeerGegeten(menu: Menu, batchId: string, receptId: string, gegeten: boolean, beoordeling: number | null, nu: Date): Menu {
  const laatstGegeten = { ...menu.laatstGegeten }
  const beoordelingen = { ...menu.beoordelingen }
  const batches = menu.batches.map((b) => {
    if (b.id !== batchId) return b
    return {
      ...b,
      gerechten: b.gerechten.map((g) => {
        if (g.receptId !== receptId) return g
        if (gegeten) {
          const vorigeKeer = menu.laatstGegeten[receptId] ?? null
          laatstGegeten[receptId] = datumNL(nu)
          if (beoordeling !== null) beoordelingen[receptId] = beoordeling
          return { ...g, gegetenOp: datumNL(nu), vorigeKeer }
        }
        if (g.gegetenOp && laatstGegeten[receptId] === g.gegetenOp) {
          if (g.vorigeKeer) laatstGegeten[receptId] = g.vorigeKeer
          else delete laatstGegeten[receptId]
        }
        return { ...g, gegetenOp: null, vorigeKeer: null }
      }),
    }
  })
  return { ...menu, batches, laatstGegeten, beoordelingen }
}

export function leegmaken(oud: Menu | null, nu: Date): Menu {
  return {
    versie: 3,
    batches: [],
    leegmakenOp: nu.toISOString(),
    laatstGegeten: { ...(oud?.laatstGegeten ?? {}) },
    beoordelingen: { ...(oud?.beoordelingen ?? {}) },
  }
}

/** Het gerecht waarmee een recept besteld is: in de oudste batch waar het nog niet gegeten is, anders in de nieuwste. */
export function gerechtVoorRecept(menu: Menu | null, receptId: string): { batch: Batch; gerecht: Gerecht } | null {
  const gevonden = (menu?.batches ?? []).flatMap((batch) => batch.gerechten.filter((g) => g.receptId === receptId).map((gerecht) => ({ batch, gerecht })))
  return gevonden.find((x) => !x.gerecht.gegetenOp) ?? gevonden[gevonden.length - 1] ?? null
}
