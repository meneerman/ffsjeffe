import { useCallback, useEffect, useState } from 'react'
import type { Instellingen, Menu, Recept, ReceptFout, Verpakkingen } from '../core/types'
import type { DataRepo, KeepStatus } from '../data/github'

export type Repo = Pick<DataRepo, 'recepten' | 'menu' | 'instellingen' | 'keepStatus' | 'zetMenu'>

export type AppData = {
  recepten: Recept[]
  fouten: ReceptFout[]
  verpakkingen: Verpakkingen
  menu: { menu: Menu; sha: string } | null
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
    Promise.all([repo.recepten(), repo.menu(), repo.instellingen(), repo.keepStatus()])
      .then(([r, menu, instellingen, keepStatus]) => {
        if (actief) setStaat({ status: 'klaar', data: { ...r, menu, instellingen, keepStatus } })
      })
      .catch((fout: Error) => actief && setStaat({ status: 'fout', fout }))
    return () => {
      actief = false
    }
  }, [repo, teller])

  return { ...staat, herlaad }
}
