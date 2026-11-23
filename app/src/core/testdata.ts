import type { Batch, Gerecht, Ingredient, Menu, Recept } from './types'

export function recept(id: string, ingredienten: Ingredient[], extra: Partial<Recept> = {}): Recept {
  return { id, titel: id, soort: 'avondeten', invriezen: false, porties: 4, tijdMinuten: 20, vooraf: null, avonden: 1, bron: null, ingredienten, benodigdheden: [], voorbereiding: [], stappen: [], notities: '', ...extra }
}
export const ing = (naam: string, hoeveelheid: number | null = null, eenheid: string | null = null): Ingredient => ({ naam, hoeveelheid, eenheid })
export const gerecht = (receptId: string, eters = 2, extra: Partial<Gerecht> = {}): Gerecht => ({ receptId, eters, avonden: 1, gegetenOp: null, vorigeKeer: null, ...extra })

/** Menu (versie 3) met één batch; `batch` en `extra` overschrijven de standaardwaarden. */
export const menuMet = (gerechten: Gerecht[], extra: Partial<Menu> = {}, batch: Partial<Batch> = {}): Menu => ({
  versie: 3,
  batches: [{ id: '2026-11-20T10:00:00.000Z', vastgezetOp: '2026-11-20T10:00:00.000Z', door: 'Partner', gerechten, boodschappen: [], ...batch }],
  leegmakenOp: null,
  laatstGegeten: {},
  beoordelingen: {},
  ...extra,
})
