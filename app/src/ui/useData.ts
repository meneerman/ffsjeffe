import { useCallback, useEffect, useState } from 'react'
import type { Concept, Instellingen, Menu, Recept, ReceptFout, Verpakkingen } from '../core/types'
import type { DataRepo, KeepStatus } from '../data/github'

export type Repo = Pick<DataRepo, 'recepten' | 'menu' | 'instellingen' | 'keepStatus' | 'zetMenu' | 'concept' | 'zetConcept'>

export type AppData = {
  recepten: Recept[]
  fouten: ReceptFout[]
  verpakkingen: Verpakkingen
  menu: { menu: Menu; sha: string } | null
  instellingen: Instellingen
  keepStatus: KeepStatus | null
  concept: { concept: Concept; sha: string } | null
}

export type DataStaat =
  | { status: 'laden' }
  | { status: 'klaar'; data: AppData }
  | { status: 'fout'; fout: Error }

export function useData(repo: Repo | null): DataStaat & { herlaad: () => void; bijgewerkt: (menu: { menu: Menu; sha: string }) => void } {
  const [staat, setStaat] = useState<DataStaat>({ status: 'laden' })
  const [teller, setTeller] = useState(0)
  const herlaad = useCallback(() => setTeller((n) => n + 1), [])

  useEffect(() => {
    if (!repo) return
    let actief = true
    // Verversen houdt de oude gegevens zichtbaar (geen flits naar "Laden…")
    setStaat((s) => (s.status === 'klaar' ? s : { status: 'laden' }))
    Promise.all([repo.recepten(), repo.menu(), repo.instellingen(), repo.keepStatus(), repo.concept()])
      .then(([r, menu, instellingen, keepStatus, concept]) => {
        if (actief) setStaat({ status: 'klaar', data: { ...r, menu, instellingen, keepStatus, concept } })
      })
      .catch((fout: Error) => actief && setStaat({ status: 'fout', fout }))
    return () => {
      actief = false
    }
  }, [repo, teller])

  /** Een net geschreven menu meteen overal zichtbaar maken (zonder op een verversing te wachten). */
  const bijgewerkt = useCallback((menu: { menu: Menu; sha: string }) => {
    setStaat((s) => (s.status === 'klaar' ? { ...s, data: { ...s.data, menu } } : s))
  }, [])

  return { ...staat, herlaad, bijgewerkt }
}
