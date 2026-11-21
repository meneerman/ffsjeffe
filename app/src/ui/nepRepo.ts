// Testhulp: een DataRepo in het geheugen.
import { parseCategorieen, parseRecept, parseVerpakkingen } from '../core/recepten'
import type { Concept, Menu, Recept } from '../core/types'
import { VerouderdFout, type KeepStatus } from '../data/github'
import { leesVoorbeeld } from '../testhulp'

export const PASTA = 'Pasta met zalm en crème fraîche'
export const WRAPS = 'Wraps met kip en crème fraîche'

export function voorbeeldRecepten(): Recept[] {
  return [PASTA, WRAPS].map((t) => parseRecept(`recepten/${t}.md`, leesVoorbeeld(`${t}.md`)) as Recept)
}

export class NepRepo {
  recepten_ = voorbeeldRecepten()
  fouten_: { pad: string; fout: string }[] = []
  menu_: { menu: Menu; sha: string } | null = null
  status_: KeepStatus | null = null
  concept_: { concept: Concept; sha: string } | null = null
  conceptGeschreven: Concept[] = []
  conceptFout: Error | null = null
  huishouden = 2
  geschreven: { menu: Menu; sha: string | null; bericht: string }[] = []
  zetFout: Error | null = null
  leesFout: Error | null = null

  async recepten() {
    if (this.leesFout) throw this.leesFout
    return { recepten: this.recepten_, fouten: this.fouten_, verpakkingen: parseVerpakkingen(leesVoorbeeld('_verpakkingen.md')),
      categorieen: parseCategorieen(leesVoorbeeld('_categorieen.md')),
    }
  }
  async menu() { return this.menu_ }
  async instellingen() { return { huishouden: this.huishouden } }
  async keepStatus() { return this.status_ }
  async concept() { return this.concept_ }
  async zetConcept(concept: Concept, sha: string | null, _bericht: string) {
    if (this.conceptFout) throw this.conceptFout
    if ((this.concept_?.sha ?? null) !== sha) throw new VerouderdFout()
    this.conceptGeschreven.push(concept)
    const nieuw = `c${this.conceptGeschreven.length}`
    this.concept_ = { concept, sha: nieuw }
    return nieuw
  }
  async zetMenu(menu: Menu, sha: string | null, bericht: string) {
    if (this.zetFout) throw this.zetFout
    if ((this.menu_?.sha ?? null) !== sha) throw new VerouderdFout() // zoals GitHub bij een verouderde sha
    this.geschreven.push({ menu, sha, bericht })
    const nieuw = `sha${this.geschreven.length}`
    this.menu_ = { menu, sha: nieuw }
    return nieuw
  }
}
