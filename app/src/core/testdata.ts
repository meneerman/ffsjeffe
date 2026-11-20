import type { Ingredient, Recept } from './types'

export function recept(id: string, ingredienten: Ingredient[], extra: Partial<Recept> = {}): Recept {
  return { id, titel: id, personen: 4, tijdMinuten: 20, dagen: 1, bron: null, ingredienten, bereiding: '', ...extra }
}
export const ing = (naam: string, hoeveelheid: number | null = null, eenheid: string | null = null): Ingredient => ({ naam, hoeveelheid, eenheid })
