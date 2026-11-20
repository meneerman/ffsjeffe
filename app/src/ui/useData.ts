import { useCallback, useEffect, useState } from 'react'
import type { Instellingen, Recept, ReceptFout, Verpakkingen, WeekPlan } from '../core/types'
import type { DataRepo, KeepStatus } from '../data/github'

export type Repo = Pick<DataRepo, 'recepten' | 'plannen' | 'instellingen' | 'keepStatus' | 'zetVast'>

export type AppData = {
  recepten: Recept[]
  fouten: ReceptFout[]
  verpakkingen: Verpakkingen
  plannen: { plan: WeekPlan; sha: string }[]
  instellingen: Instellingen
  keepStatus: KeepStatus | null
}

export type DataStaat =
  | { status: 'laden' }
  | { status: 'klaar'; data: AppData }
  | { status: 'fout'; fout: Error }

export function useData(repo: Repo | null): DataStaat & { herlaad: () => void } {
  const [staat, setStaat] = useState<DataStaat>({ status: 'laden' })
  const [teller, setTeller] = useState(0)
  const herlaad = useCallback(() => setTeller((n) => n + 1), [])

  useEffect(() => {
    if (!repo) return
    let actief = true
    setStaat({ status: 'laden' })
    Promise.all([repo.recepten(), repo.plannen(), repo.instellingen(), repo.keepStatus()])
      .then(([r, plannen, instellingen, keepStatus]) => {
        if (actief) setStaat({ status: 'klaar', data: { ...r, plannen, instellingen, keepStatus } })
      })
      .catch((fout: Error) => actief && setStaat({ status: 'fout', fout }))
    return () => {
      actief = false
    }
  }, [repo, teller])

  return { ...staat, herlaad }
}
