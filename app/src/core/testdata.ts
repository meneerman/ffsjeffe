import type { Gerecht, Ingredient, Recept } from './types'

export function recept(id: string, ingredienten: Ingredient[], extra: Partial<Recept> = {}): Recept {
  return { id, titel: id, porties: 4, tijdMinuten: 20, avonden: 1, bron: null, ingredienten, benodigdheden: [], voorbereiding: [], stappen: [], notities: '', ...extra }
}
export const ing = (naam: string, hoeveelheid: number | null = null, eenheid: string | null = null): Ingredient => ({ naam, hoeveelheid, eenheid })
export const gerecht = (receptId: string, eters = 2, extra: Partial<Gerecht> = {}): Gerecht => ({ receptId, eters, avonden: 1, gegetenOp: null, vorigeKeer: null, ...extra })
