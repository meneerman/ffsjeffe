export type Ingredient = { naam: string; hoeveelheid: number | null; eenheid: string | null }

export type Recept = {
  id: string
  titel: string
  personen: number
  tijdMinuten: number
  dagen: number
  bron: string | null
  ingredienten: Ingredient[]
  bereiding: string
}

export type ReceptFout = { pad: string; fout: string }

export type Verpakking = { hoeveelheid: number; eenheid: string }
/** Sleutel = sleutel(naam) */
export type Verpakkingen = Record<string, Verpakking>

export type Slot = { receptId: string; dagen: number }

export type WeekPlan = {
  week: string
  status: 'vastgezet'
  slots: Slot[]
  boodschappen: string[]
  vastgezetOp: string
  door: string
}

export type Instellingen = { huishouden: number }
