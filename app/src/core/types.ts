export const SOORTEN = ['ontbijt', 'lunch', 'avondeten', 'voorgerecht', 'toetje', 'snack'] as const
export type Soort = (typeof SOORTEN)[number]

export type Ingredient = { naam: string; hoeveelheid: number | null; eenheid: string | null }

/** id = titel = bestandsnaam zonder .md */
export type Recept = {
  id: string
  titel: string
  soort: Soort
  /** goed in te vriezen */
  invriezen: boolean
  porties: number
  tijdMinuten: number
  /** standaard aantal avonden waarvoor je dit gerecht kookt (batch: meer dan 1); per gerecht aan te passen */
  avonden: number
  bron: string | null
  ingredienten: Ingredient[]
  /** alleen speciaal gereedschap */
  benodigdheden: string[]
  voorbereiding: string[]
  stappen: string[]
  notities: string
}

export type ReceptFout = { pad: string; fout: string }

export type Verpakking = { hoeveelheid: number; eenheid: string }
/** Sleutel = sleutel(naam) */
export type Verpakkingen = Record<string, Verpakking>

/** eters en avonden zijn per gerecht instelbaar; avonden begint op de standaard van het recept. */
export type Gerecht = { receptId: string; eters: number; avonden: number; gegetenOp: string | null; vorigeKeer: string | null }

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

/** Menu in de maak: gedeeld tussen toestellen, nog niet naar Keep. `sinds` = laatste wijziging. */
export type Concept = { gerechten: Gerecht[]; sinds: string; door: string }

export type Instellingen = { huishouden: number }
