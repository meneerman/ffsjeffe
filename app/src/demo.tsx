import { createRoot } from 'react-dom/client'
import { parseRecept, parseVerpakkingen } from './core/recepten'
import type { Menu, Recept } from './core/types'
import App from './ui/App'
import pasta from '../../data-template/recepten/Pasta met zalm en crème fraîche.md?raw'
import wraps from '../../data-template/recepten/Wraps met kip en crème fraîche.md?raw'
import vp from '../../data-template/recepten/_verpakkingen.md?raw'

const extra = ['Linzensoep', 'Shakshuka', 'Risotto met paddenstoelen', 'Thaise curry'].map((t, i) =>
  parseRecept(`recepten/${t}.md`, `---\nporties: 4\ntijd: ${20 + i * 10}\n${i === 0 ? 'avonden: 2\n' : ''}ingredienten:\n  - 2 ui\n  - 400 g ${['linzen', 'tomaten', 'risottorijst', 'kip'][i]}\n---\n## Bereiding\n1. Snipper {2} uien.\n2. Kook {400 g} ${['linzen', 'tomaten', 'rijst', 'kip'][i]} 20 min.\n`) as Recept)
const recepten = [parseRecept('recepten/Pasta met zalm en crème fraîche.md', pasta) as Recept, parseRecept('recepten/Wraps met kip en crème fraîche.md', wraps) as Recept, ...extra]
let menu: { menu: Menu; sha: string } | null = null
const repo = {
  recepten: async () => ({ recepten, fouten: [], verpakkingen: parseVerpakkingen(vp) }),
  menu: async () => menu,
  instellingen: async () => ({ huishouden: 2 }),
  keepStatus: async () => ({ tijd: new Date().toISOString(), ok: true, melding: '', weken: [] }),
  zetMenu: async (m: Menu) => { menu = { menu: m, sha: String(Date.now()) }; return menu.sha },
}
localStorage.setItem('ffsjeffe.verbinding', JSON.stringify({ owner: 'o', repo: 'r', token: 't', naam: 'Menno' }))
createRoot(document.getElementById('root')!).render(<App maakRepo={() => repo} />)
