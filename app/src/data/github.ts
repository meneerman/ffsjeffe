import { parseRecept, parseVerpakkingen } from '../core/recepten'
import type { Concept, Instellingen, Menu, Recept, ReceptFout, Verpakkingen } from '../core/types'

export type Verbinding = { owner: string; repo: string; token: string }
export type KeepStatus = { tijd: string; ok: boolean; melding: string; weken: string[] }

export const STANDAARD_REPO = { owner: 'meneerman', repo: 'ffsjeffe-data' }

export class VerouderdFout extends Error {
  constructor() {
    super('Iemand anders heeft het menu net aangepast. Herlaad en probeer opnieuw.')
  }
}
export class TokenFout extends Error {
  constructor() {
    super('Het token werkt niet (meer). Vul een nieuw token in.')
  }
}

export function naarBase64(tekst: string): string {
  let binair = ''
  for (const b of new TextEncoder().encode(tekst)) binair += String.fromCharCode(b)
  return btoa(binair)
}

export function vanBase64(b64: string): string {
  const binair = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(binair, (c) => c.charCodeAt(0)))
}

const MENU = 'weekmenu/menu.json'
/** Het gedeelde concept: bewust een apart bestand, want alleen een push op menu.json start de Keep-sync. */
const CONCEPT = 'weekmenu/concept.json'

export class DataRepo {
  constructor(private v: Verbinding, private f: typeof fetch = (...a) => fetch(...a)) {}

  private async vraag(pad: string, init: RequestInit = {}, toegestaan: number[] = []): Promise<Response> {
    const res = await this.f(`https://api.github.com/repos/${this.v.owner}/${this.v.repo}/${pad}`, {
      ...init,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${this.v.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    if (res.ok || toegestaan.includes(res.status)) return res
    if (res.status === 401 || res.status === 403) throw new TokenFout()
    throw new Error(`GitHub gaf status ${res.status}`)
  }

  private async paden(): Promise<string[]> {
    const res = await this.vraag('git/trees/main?recursive=1', {}, [404, 409])
    if (!res.ok) return [] // lege of nog niet bestaande branch
    const data = (await res.json()) as { tree: { path: string; type: string }[] }
    return data.tree.filter((t) => t.type === 'blob').map((t) => t.path)
  }

  private async bestand(pad: string): Promise<{ inhoud: string; sha: string } | null> {
    const res = await this.vraag(`contents/${pad.split('/').map(encodeURIComponent).join('/')}?ref=main`, {}, [404])
    if (res.status === 404) return null
    const data = (await res.json()) as { content: string; sha: string }
    return { inhoud: vanBase64(data.content), sha: data.sha }
  }

  async recepten(): Promise<{ recepten: Recept[]; fouten: ReceptFout[]; verpakkingen: Verpakkingen }> {
    const md = (await this.paden()).filter((p) => p.startsWith('recepten/') && p.endsWith('.md'))
    const isExtra = (p: string) => p.split('/').pop()!.startsWith('_')
    const [verpakkingsBestand, ...bestanden] = await Promise.all([
      md.includes('recepten/_verpakkingen.md') ? this.bestand('recepten/_verpakkingen.md') : Promise.resolve(null),
      ...md.filter((p) => !isExtra(p)).map(async (p) => ({ pad: p, b: await this.bestand(p) })),
    ])
    const recepten: Recept[] = []
    const fouten: ReceptFout[] = []
    for (const { pad, b } of bestanden as { pad: string; b: { inhoud: string } | null }[]) {
      if (!b) continue
      const r = parseRecept(pad, b.inhoud)
      if ('fout' in r) fouten.push(r)
      else recepten.push(r)
    }
    return { recepten, fouten, verpakkingen: verpakkingsBestand ? parseVerpakkingen(verpakkingsBestand.inhoud) : {} }
  }

  /** sha van een bestaande maar onbruikbare menu.json, zodat vastzetten hem kan overschrijven. */
  private onbruikbaarSha: string | null = null

  async menu(): Promise<{ menu: Menu; sha: string } | null> {
    const b = await this.bestand(MENU)
    this.onbruikbaarSha = null
    if (!b) return null
    try {
      const menu = JSON.parse(b.inhoud) as Menu
      if (menu && menu.versie === 2 && Array.isArray(menu.gerechten)) return { menu, sha: b.sha }
    } catch {
      /* onbruikbaar */
    }
    this.onbruikbaarSha = b.sha
    return null
  }

  async instellingen(): Promise<Instellingen> {
    const b = await this.bestand('weekmenu/instellingen.json')
    return { huishouden: 4, ...(b ? (JSON.parse(b.inhoud) as Partial<Instellingen>) : {}) }
  }

  async keepStatus(): Promise<KeepStatus | null> {
    const b = await this.bestand('weekmenu/keep-status.json')
    return b ? (JSON.parse(b.inhoud) as KeepStatus) : null
  }

  async concept(): Promise<{ concept: Concept; sha: string } | null> {
    const b = await this.bestand(CONCEPT)
    if (!b) return null
    try {
      const c = JSON.parse(b.inhoud) as Concept
      if (c && Array.isArray(c.gerechten) && typeof c.sinds === 'string') return { concept: c, sha: b.sha }
    } catch {
      /* onbruikbaar: negeren, de eerstvolgende wijziging overschrijft het */
    }
    return null
  }

  private async schrijf(pad: string, waarde: unknown, sha: string | null, bericht: string): Promise<string> {
    const body: Record<string, string> = {
      message: bericht,
      content: naarBase64(JSON.stringify(waarde, null, 2) + '\n'),
      branch: 'main',
    }
    if (sha) body.sha = sha
    const res = await this.vraag(`contents/${pad}`, { method: 'PUT', body: JSON.stringify(body) }, [409, 422])
    if (res.status === 409) throw new VerouderdFout()
    if (res.status === 422) {
      const tekst = await res.text()
      if (/sha/i.test(tekst)) throw new VerouderdFout()
      throw new Error('GitHub gaf status 422')
    }
    return ((await res.json()) as { content: { sha: string } }).content.sha
  }

  async zetMenu(menu: Menu, sha: string | null, bericht: string): Promise<string> {
    return this.schrijf(MENU, menu, sha ?? this.onbruikbaarSha, bericht)
  }

  async zetConcept(concept: Concept, sha: string | null, bericht: string): Promise<string> {
    return this.schrijf(CONCEPT, concept, sha, bericht)
  }
}
