export type Ingredient = { naam: string; hoeveelheid: number | null; eenheid: string | null }

/** id = titel = bestandsnaam zonder .md */
export type Recept = {
  id: string
  titel: string
  porties: number
  tijdMinuten: number
  avonden: number
  bron: string | null
  ingredienten: Ingredient[]
  stappen: string[]
  notities: string
}

export type ReceptFout = { pad: string; fout: string }

export type Verpakking = { hoeveelheid: number; eenheid: string }
/** Sleutel = sleutel(naam) */
export type Verpakkingen = Record<string, Verpakking>

export type Gerecht = { receptId: string; eters: number; gegetenOp: string | null; vorigeKeer: string | null }

export type Menu = {
  versie: 2
  ronde: string
  gerechten: Gerecht[]
  boodschappen: string[]
  vastgezetOp: string
  door: string
  leegmakenOp: string | null
  laatstGegeten: Record<string, string>
}

export type Instellingen = { huishouden: number }
