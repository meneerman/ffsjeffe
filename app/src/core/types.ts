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
  /** wat een dag (of nacht) van tevoren moet gebeuren, kort: "24 uur marineren" */
  vooraf: string | null
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

/** Supermarktafdelingen in winkelvolgorde; Overig is altijd laatst en vangt wat nergens in staat. */
export const CATEGORIEEN = [
  'Groente & fruit',
  'Vlees & vis',
  'Zuivel & eieren',
  'Brood',
  'Droog',
  'Blik & pot',
  'Kruiden & specerijen',
  'Olie, sauzen & azijn',
  'Diepvries',
  'Overig',
] as const
export type Categorie = (typeof CATEGORIEEN)[number]
/** Sleutel = sleutel(naam) */
export type Categorieen = Record<string, Categorie>

export type Verpakking = { hoeveelheid: number; eenheid: string }
/** Sleutel = sleutel(naam) */
export type Verpakkingen = Record<string, Verpakking>

/** eters en avonden zijn per gerecht instelbaar; avonden begint op de standaard van het recept. */
export type Gerecht = { receptId: string; eters: number; avonden: number; gegetenOp: string | null; vorigeKeer: string | null }

/** Een kookbatch: wat in één keer naar Keep is gestuurd (en dus besteld). `id` = tijdstip van naar Keep sturen. */
export type Batch = { id: string; vastgezetOp: string; door: string; gerechten: Gerecht[]; boodschappen: string[] }

export type Menu = {
  versie: 3
  /** oudste eerst */
  batches: Batch[]
  leegmakenOp: string | null
  laatstGegeten: Record<string, string>
  /** receptId → 0..5 */
  beoordelingen: Record<string, number>
}

/** Oud formaat (één ronde); wordt bij het lezen omgezet naar één batch. */
export type MenuV2 = {
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
