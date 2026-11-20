// Testhulp: een DataRepo in het geheugen.
import { leesVoorbeeld } from '../testhulp'
import { parseRecept, parseVerpakkingen } from '../core/recepten'
import type { Recept, WeekPlan } from '../core/types'
import type { KeepStatus } from '../data/github'

const lees = leesVoorbeeld

export function voorbeeldRecepten(): Recept[] {
  return ['pasta-zalm.md', 'wraps-kip.md'].map((f) => parseRecept(`recepten/${f}`, lees(f)) as Recept)
}

export class NepRepo {
  recepten_ = voorbeeldRecepten()
  fouten_: { pad: string; fout: string }[] = []
  plannen_: { plan: WeekPlan; sha: string }[] = []
  status_: KeepStatus | null = null
  huishouden = 2
  vastgezet: { plan: WeekPlan; sha: string | null }[] = []
  zetVastFout: Error | null = null
  leesFout: Error | null = null

  async recepten() {
    if (this.leesFout) throw this.leesFout
    return { recepten: this.recepten_, fouten: this.fouten_, verpakkingen: parseVerpakkingen(lees('_verpakkingen.md')) }
  }
  async plannen() { return this.plannen_ }
  async instellingen() { return { huishouden: this.huishouden } }
  async keepStatus() { return this.status_ }
  async zetVast(plan: WeekPlan, sha: string | null) {
    if (this.zetVastFout) throw this.zetVastFout
    this.vastgezet.push({ plan, sha })
    const nieuw = `sha${this.vastgezet.length}`
    this.plannen_ = [...this.plannen_.filter((p) => p.plan.week !== plan.week), { plan, sha: nieuw }]
    return nieuw
  }
}
